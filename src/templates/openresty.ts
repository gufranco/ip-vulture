import { ServerName, type ServerTemplate } from "./template.js";

const openrestyTemplate: ServerTemplate = {
  name: ServerName.OpenResty,

  headers: Object.freeze({
    "Content-Type": "text/html",
    Server: "openresty/1.27.1.1",
  }),

  render(): string {
    return `<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>openresty/1.27.1.1</center>
</body>
</html>
`;
  },
};

export { openrestyTemplate };
