import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createSmtpTransport, formatMessage, stuffDots } from "../mailer.js";

const smtp = {
  host: "smtp.example.invalid",
  port: 587,
  secure: false,
  user: "mailer",
  password: "secret",
};

function scriptedSocket(replies: readonly string[]) {
  const socket = new PassThrough();
  const written: string[] = [];
  let step = 0;

  const originalWrite = socket.write.bind(socket);

  Object.defineProperty(socket, "write", {
    value: (chunk: string | Uint8Array) => {
      written.push(chunk.toString());

      const reply = replies[step];
      step += 1;

      if (reply !== undefined) {
        setImmediate(() => socket.push(reply));
      }

      return true;
    },
  });

  Object.defineProperty(socket, "setTimeout", { value: () => socket });
  Object.defineProperty(socket, "destroy", { value: () => originalWrite });

  return { socket, written };
}

const happyPath = [
  "250-smtp.example.invalid\r\n250 AUTH LOGIN PLAIN\r\n",
  "334 VXNlcm5hbWU6\r\n",
  "334 UGFzc3dvcmQ6\r\n",
  "235 authenticated\r\n",
  "250 sender ok\r\n",
  "250 recipient ok\r\n",
  "354 start mail input\r\n",
  "250 queued\r\n",
  "221 bye\r\n",
];

describe("stuffDots", () => {
  it("should escape a leading dot on a line", () => {
    expect(stuffDots("line one\r\n.hidden\r\n")).toBe(
      "line one\r\n..hidden\r\n",
    );
  });

  it("should leave a dot mid-line alone", () => {
    expect(stuffDots("a.b\r\n")).toBe("a.b\r\n");
  });

  it("should handle a body that is only a dot", () => {
    expect(stuffDots(".")).toBe("..");
  });
});

describe("formatMessage", () => {
  it("should carry the envelope headers", () => {
    const message = formatMessage({
      from: "alerts@example.invalid",
      to: "ops@example.invalid",
      subject: "Access alert",
      body: "one line\n",
      date: new Date("2026-08-16T10:00:00Z"),
    });

    expect(message).toContain("From: alerts@example.invalid");
    expect(message).toContain("To: ops@example.invalid");
    expect(message).toContain("Subject: Access alert");
    expect(message).toContain("Content-Type: text/plain; charset=utf-8");
  });

  it("should normalize newlines to CRLF", () => {
    const message = formatMessage({
      from: "a@b.invalid",
      to: "c@d.invalid",
      subject: "s",
      body: "one\ntwo\n",
      date: new Date("2026-08-16T10:00:00Z"),
    });

    expect(message).not.toMatch(/[^\r]\n/);
  });

  it("should fold a header injection attempt into the subject value", () => {
    const message = formatMessage({
      from: "a@b.invalid",
      to: "c@d.invalid",
      subject: "hello\r\nBcc: attacker@evil.invalid",
      body: "body\n",
      date: new Date("2026-08-16T10:00:00Z"),
    });

    const headerBlock = message.split("\r\n\r\n")[0] ?? "";
    const headerNames = headerBlock
      .split("\r\n")
      .map((line) => line.split(":")[0]?.toLowerCase() ?? "");

    expect(headerNames).not.toContain("bcc");
    expect(headerBlock).toContain("Subject: hello Bcc: attacker@evil.invalid");
  });

  it("should fold a header injection attempt in the recipient", () => {
    const message = formatMessage({
      from: "a@b.invalid",
      to: "c@d.invalid\r\nBcc: attacker@evil.invalid",
      subject: "s",
      body: "body\n",
      date: new Date("2026-08-16T10:00:00Z"),
    });

    const headerNames = (message.split("\r\n\r\n")[0] ?? "")
      .split("\r\n")
      .map((line) => line.split(":")[0]?.toLowerCase() ?? "");

    expect(headerNames).not.toContain("bcc");
  });
});

describe("createSmtpTransport", () => {
  it("should complete a full send over the scripted session", async () => {
    const { socket, written } = scriptedSocket(happyPath);
    const connect = vi.fn().mockImplementation(() => {
      setImmediate(() => socket.push("220 ready\r\n"));

      return Promise.resolve(socket);
    });

    const transport = createSmtpTransport({ smtp, connect, timeoutMs: 1000 });

    await transport.send({
      from: "alerts@example.invalid",
      to: "ops@example.invalid",
      subject: "Access alert",
      body: "one access\n",
    });

    const session = written.join("");

    expect(session).toContain("EHLO");
    expect(session).toContain("AUTH LOGIN");
    expect(session).toContain("MAIL FROM:<alerts@example.invalid>");
    expect(session).toContain("RCPT TO:<ops@example.invalid>");
    expect(session).toContain("DATA");
    expect(session).toContain("QUIT");
  });

  it("should reject when the server refuses the sender", async () => {
    const { socket } = scriptedSocket([
      "250 ok\r\n",
      "334 VXNlcm5hbWU6\r\n",
      "334 UGFzc3dvcmQ6\r\n",
      "235 authenticated\r\n",
      "550 sender rejected\r\n",
    ]);
    const connect = vi.fn().mockImplementation(() => {
      setImmediate(() => socket.push("220 ready\r\n"));

      return Promise.resolve(socket);
    });

    const transport = createSmtpTransport({ smtp, connect, timeoutMs: 1000 });

    await expect(
      transport.send({
        from: "alerts@example.invalid",
        to: "ops@example.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow(/550/);
  });

  it("should reject when the greeting is not a 220", async () => {
    const { socket } = scriptedSocket([]);
    const connect = vi.fn().mockImplementation(() => {
      setImmediate(() => socket.push("554 no service\r\n"));

      return Promise.resolve(socket);
    });

    const transport = createSmtpTransport({ smtp, connect, timeoutMs: 1000 });

    await expect(
      transport.send({
        from: "a@b.invalid",
        to: "c@d.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow(/554/);
  });

  it("should reject when the connection cannot be opened", async () => {
    const connect = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const transport = createSmtpTransport({ smtp, connect, timeoutMs: 1000 });

    await expect(
      transport.send({
        from: "a@b.invalid",
        to: "c@d.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it("should skip authentication when no user is configured", async () => {
    const { socket, written } = scriptedSocket([
      "250 ok\r\n",
      "250 sender ok\r\n",
      "250 recipient ok\r\n",
      "354 go ahead\r\n",
      "250 queued\r\n",
      "221 bye\r\n",
    ]);
    const connect = vi.fn().mockImplementation(() => {
      setImmediate(() => socket.push("220 ready\r\n"));

      return Promise.resolve(socket);
    });

    const transport = createSmtpTransport({
      smtp: { ...smtp, user: "", password: "" },
      connect,
      timeoutMs: 1000,
    });

    await transport.send({
      from: "a@b.invalid",
      to: "c@d.invalid",
      subject: "s",
      body: "b\n",
    });

    expect(written.join("")).not.toContain("AUTH");
  });
});
