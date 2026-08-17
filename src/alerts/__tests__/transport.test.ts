import { once } from "node:events";
import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createSmtpTransport } from "../mailer.js";

let server: Server | undefined;

async function startServer(behaviour: "accept" | "hang"): Promise<number> {
  const created = createServer((socket) => {
    socket.setEncoding("utf8");

    if (behaviour === "hang") {
      return;
    }

    socket.write("220 local ready\r\n");

    let inData = false;

    socket.on("data", (chunk: string) => {
      for (const line of chunk
        .split("\r\n")
        .filter((part) => part.length > 0)) {
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 queued\r\n");
          }

          continue;
        }

        const verb = line.slice(0, 4).toUpperCase().trim();

        if (verb === "DATA") {
          inData = true;
          socket.write("354 go\r\n");

          continue;
        }

        if (verb === "EHLO") {
          socket.write("250-local\r\n250 AUTH LOGIN\r\n");

          continue;
        }

        if (verb === "AUTH") {
          socket.write("334 VXNlcm5hbWU6\r\n");

          continue;
        }

        if (verb === "QUIT") {
          socket.write("221 bye\r\n");

          continue;
        }

        if (verb === "MAIL" || verb === "RCPT") {
          socket.write("250 ok\r\n");

          continue;
        }

        socket.write("334 UGFzc3dvcmQ6\r\n");
      }
    });
  });

  created.listen(0, "127.0.0.1");
  await once(created, "listening");

  server = created;

  const address = created.address();

  if (address === null || typeof address === "string") {
    throw new Error("failed to bind the test SMTP server");
  }

  return address.port;
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe("createSmtpTransport over a real socket", () => {
  it("should reject when nothing is listening", async () => {
    const transport = createSmtpTransport({
      smtp: {
        host: "127.0.0.1",
        port: 1,
        secure: false,
        user: "",
        password: "",
      },
      timeoutMs: 2000,
    });

    await expect(
      transport.send({
        from: "a@b.invalid",
        to: "c@d.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow();
  });

  it("should time out when the server never greets", async () => {
    const port = await startServer("hang");

    const transport = createSmtpTransport({
      smtp: {
        host: "127.0.0.1",
        port,
        secure: false,
        user: "",
        password: "",
      },
      timeoutMs: 250,
    });

    await expect(
      transport.send({
        from: "a@b.invalid",
        to: "c@d.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("should complete a session against a listening server", async () => {
    const port = await startServer("accept");

    const transport = createSmtpTransport({
      smtp: {
        host: "127.0.0.1",
        port,
        secure: false,
        user: "",
        password: "",
      },
      timeoutMs: 3000,
    });

    await expect(
      transport.send({
        from: "alerts@example.invalid",
        to: "ops@example.invalid",
        subject: "Access alert",
        body: "one access\n.dot line\n",
      }),
    ).resolves.toBeUndefined();
  });
});
