import { ServerName, type ServerTemplate } from "./template.js";

const nginxTemplate: ServerTemplate = {
  name: ServerName.Nginx,

  headers: Object.freeze({
    "Content-Type": "text/html",
    Server: "nginx/1.27.4",
  }),

  render(): string {
    return `<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx/1.27.4</center>
</body>
</html>
`;
  },
};

export { nginxTemplate };
