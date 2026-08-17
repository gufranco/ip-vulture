import { connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";
import { connect as tlsConnect } from "node:tls";
import type { SmtpConfig } from "../config/config.js";

const CRLF = "\r\n";

interface MailMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

interface FormatOptions extends MailMessage {
  readonly date: Date;
}

interface SmtpTransportOptions {
  readonly smtp: SmtpConfig;
  readonly timeoutMs: number;
  readonly connect?: (smtp: SmtpConfig) => Promise<Duplex>;
}

interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

function headerSafe(value: string): string {
  return value.replaceAll(/[\r\n]+/g, " ").trim();
}

function stuffDots(body: string): string {
  return body
    .split(CRLF)
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join(CRLF);
}

function formatMessage(options: FormatOptions): string {
  const normalized = options.body.replaceAll(/\r?\n/g, CRLF);

  const headers = [
    `From: ${headerSafe(options.from)}`,
    `To: ${headerSafe(options.to)}`,
    `Subject: ${headerSafe(options.subject)}`,
    `Date: ${options.date.toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "Auto-Submitted: auto-generated",
  ];

  return `${headers.join(CRLF)}${CRLF}${CRLF}${normalized}`;
}

function defaultConnect(smtp: SmtpConfig): Promise<Duplex> {
  return new Promise((resolve, reject) => {
    const socket = smtp.secure
      ? tlsConnect({ host: smtp.host, port: smtp.port, servername: smtp.host })
      : netConnect({ host: smtp.host, port: smtp.port });

    const onError = (error: Error) => reject(error);

    socket.once("error", onError);
    socket.once(smtp.secure ? "secureConnect" : "connect", () => {
      socket.removeListener("error", onError);
      resolve(socket);
    });
  });
}

function createSession(socket: Duplex, timeoutMs: number) {
  let buffer = "";
  let waiter: ((line: string) => void) | undefined;
  let failer: ((error: Error) => void) | undefined;

  socket.setEncoding?.("utf8");

  socket.on("data", (chunk: string) => {
    buffer += chunk;

    const terminator = /^\d{3} [^\r\n]*\r\n/m;

    if (terminator.test(buffer) && waiter !== undefined) {
      const complete = buffer;

      buffer = "";
      const resolve = waiter;
      waiter = undefined;
      failer = undefined;
      resolve(complete);
    }
  });

  socket.on("error", (error: Error) => {
    failer?.(error);
  });

  function expect(codes: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`SMTP timed out waiting for ${codes.join(" or ")}`));
      }, timeoutMs);

      waiter = (line: string) => {
        clearTimeout(timer);

        const status = line.trimStart().slice(0, 3);

        if (!codes.includes(status)) {
          reject(
            new Error(
              `SMTP expected ${codes.join(" or ")}, got ${line.trim()}`,
            ),
          );

          return;
        }

        resolve(line);
      };

      failer = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
    });
  }

  function send(command: string): void {
    socket.write(`${command}${CRLF}`);
  }

  async function exchange(
    command: string,
    codes: readonly string[],
  ): Promise<string> {
    const pending = expect(codes);

    send(command);

    return pending;
  }

  return { expect, exchange, send };
}

function createSmtpTransport(options: SmtpTransportOptions): MailTransport {
  const connect = options.connect ?? defaultConnect;

  return Object.freeze({
    async send(message: MailMessage): Promise<void> {
      const socket = await connect(options.smtp);
      const session = createSession(socket, options.timeoutMs);

      try {
        await session.expect(["220"]);
        await session.exchange(`EHLO ip-vulture`, ["250"]);

        if (options.smtp.user.length > 0) {
          await session.exchange("AUTH LOGIN", ["334"]);
          await session.exchange(
            Buffer.from(options.smtp.user, "utf8").toString("base64"),
            ["334"],
          );
          await session.exchange(
            Buffer.from(options.smtp.password, "utf8").toString("base64"),
            ["235"],
          );
        }

        await session.exchange(`MAIL FROM:<${headerSafe(message.from)}>`, [
          "250",
        ]);
        await session.exchange(`RCPT TO:<${headerSafe(message.to)}>`, [
          "250",
          "251",
        ]);
        await session.exchange("DATA", ["354"]);

        const payload = formatMessage({ ...message, date: new Date() });

        session.send(
          `${stuffDots(payload.replaceAll(/\r?\n/g, CRLF))}${CRLF}.`,
        );

        await session.expect(["250"]);
        await session.exchange("QUIT", ["221"]);
      } finally {
        socket.destroy?.();
      }
    },
  });
}

export {
  createSmtpTransport,
  formatMessage,
  type MailMessage,
  type MailTransport,
  type SmtpTransportOptions,
  stuffDots,
};
