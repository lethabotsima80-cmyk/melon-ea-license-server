
const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

function getLicenses() {
  try {
    return JSON.parse(process.env.LICENSES_JSON || "{}");
  } catch {
    return {};
  }
}

function isLicenseValid(expiry) {
  if (expiry === "never") return true;

  if (
    typeof expiry !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expiry)
  ) return false;

  const date = new Date(expiry + "T23:59:59.999Z");

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(expiry) &&
    Date.now() <= date.getTime();
}

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { status: "online", product: "Melon EA" });
  }

  if (req.method !== "POST" || req.url !== "/verify") {
    return send(res, 404, { valid: false, message: "Not found" });
  }

  let body = "";

  req.on("data", chunk => {
    body += chunk;

    if (body.length > 8192) {
      req.destroy();
    }
  });

  req.on("end", () => {
    try {
      const data = JSON.parse(body);
      const key = data.license_key;

      if (
        typeof key !== "string" ||
        key.length < 8 ||
        key.length > 200
      ) {
        return send(res, 400, {
          valid: false,
          message: "Invalid request"
        });
      }

      const licenses = getLicenses();
      const submittedHash = crypto
        .createHash("sha256")
        .update(key.trim())
        .digest();

      let expiry = null;

      for (const [storedKey, storedExpiry] of Object.entries(licenses)) {
        const storedHash = crypto
          .createHash("sha256")
          .update(storedKey)
          .digest();

        if (crypto.timingSafeEqual(submittedHash, storedHash)) {
          expiry = storedExpiry;
          break;
        }
      }

      if (expiry === null || !isLicenseValid(expiry)) {
        return send(res, 200, {
          valid: false,
          message: "Invalid or expired access key"
        });
      }

      return send(res, 200, {
        valid: true,
        product: "Melon EA",
        message: "Access approved",
        expires_at: expiry
      });

    } catch {
      return send(res, 400, {
        valid: false,
        message: "Invalid request"
      });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Melon EA License Server running on port " + PORT);
});
