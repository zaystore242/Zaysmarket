const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment-timezone");
const axios = require("axios");
const cloudscraper = require("cloudscraper");
const qs = require("querystring");

const upgradePrices = {
  reseller: { admin: 10000, pt: 15000 },
  admin: { pt: 20000 },
};
const {
  createPterodactylUser,
  createPterodactylServer,
} = require("../lib/function");
const { domain, atlakey } = require("../setting");
const PTERO_DOMAIN = domain;
const API_KEY = atlakey;

const router = express.Router();

const MONGO_URI = "mongodb+srv://gini:ggoktkkyoAnfTF0O@hiro.pwhagfj.mongodb.net/dalangstore?retryWrites=true&w=majority&appName=Hiro";
const User = mongoose.model("User");

function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/");
}

function checkRole(role) {
  return (req, res, next) => {
    if (req.session.user && req.session.user.role === role) return next();
    return res.status(403).send("Akses ditolak");
  };
}
router.post("/upgrade", isLoggedIn, async (req, res) => {
  try {
    const { targetRole } = req.body;
    if (!targetRole) return res.status(400).json({ status: false, msg: "Target role wajib diisi" });

    const currentUser = await User.findById(req.session.user.id);
    if (!currentUser) return res.status(404).json({ status: false, msg: "User tidak ditemukan" });

    if (targetRole === "owner") return res.status(400).json({ status: false, msg: "Tidak bisa upgrade ke owner" });

    const userRole = currentUser.role;
    if (!upgradePrices[userRole] || !upgradePrices[userRole][targetRole]) {
      return res.status(400).json({ status: false, msg: `Tidak bisa upgrade dari ${userRole} ke ${targetRole}` });
    }
    const nominal = upgradePrices[userRole][targetRole];

    const reff_id = "REF" + Date.now();
    const formData = qs.stringify({
      api_key: API_KEY,
      reff_id,
      nominal,
      type: "ewallet",
      metode: "qrisfast",
    });

    const depositResponse = await cloudscraper({
      method: "POST",
      url: "https://atlantich2h.com/deposit/create",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    const depositData = JSON.parse(depositResponse);

    res.json({
      status: true,
      msg: "Deposit dibuat, cek status otomatis setiap 3 detik",
      deposit: depositData.data,
    });

    const interval = setInterval(async () => {
      try {
        const formStatus = qs.stringify({ api_key: API_KEY, id: depositData.data.id });
        const statusResponse = await cloudscraper({
          method: "POST",
          url: "https://atlantich2h.com/deposit/status",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formStatus,
        });
        const statusData = JSON.parse(statusResponse);

        if (["processing", "success"].includes(statusData.data.status.toLowerCase())) {

          currentUser.role = targetRole;
          await currentUser.save();
          clearInterval(interval);
          console.log(`User ${currentUser.username} berhasil diupgrade ke ${targetRole}`);
        } else if (statusData.data.status.toLowerCase() === "failed") {
          clearInterval(interval);
          console.log(`Deposit ${depositData.data.id} gagal`);
        }
      } catch (err) {
        console.error("Error cek status deposit:", err.message);
      }
    }, 3000); 
  } catch (err) {
    console.error("Error upgrade user:", err.message);
    return res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});


router.post("/status", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ status: false, msg: "ID Deposit wajib diisi" });
    }

    const formData = qs.stringify({
      api_key: API_KEY,
      id
    });

    const response = await cloudscraper({
      method: "POST",
      url: "https://atlantich2h.com/deposit/status",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: formData
    });

    const apiRes = JSON.parse(response);

    res.json({
      status: apiRes.status,
      data: {
        id: apiRes.data.id,
        reff_id: apiRes.data.reff_id,
        nominal: apiRes.data.nominal,
        tambahan: apiRes.data.tambahan,
        fee: apiRes.data.fee,
        get_balance: apiRes.data.get_balance,
        metode: apiRes.data.metode,
        status: apiRes.data.status,
        created_at: apiRes.data.created_at
      },
      code: apiRes.code
    });
  } catch (err) {
    console.error("Error cek status:", err.message);
    res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});
router.post("/cpanel", isLoggedIn, async (req, res) => {
  console.log("📥 [POST /cpanel] Data diterima:", req.body);
  const { serverName, userId, ram, disk, cpu, platform, max_players } = req.body;
  if (
    serverName === undefined || serverName === "" ||
    ram === undefined || ram === "" ||
    disk === undefined || disk === "" ||
    cpu === undefined || cpu === "" ||
    platform === undefined || platform === ""
  ) {
    console.log("❌ [POST /cpanel] Data tidak lengkap:", { serverName, ram, disk, cpu, platform, max_players });
    return res.status(400).json({ error: "Data spesifikasi atau nama server tidak lengkap." });
  }
  console.log("✅ [POST /cpanel] Data valid:", { serverName, userId, ram, disk, cpu, platform, max_players });

  let nestId, eggId, dockerImage, startupCmd;
  let environment = {};
  let voicePort = null;
  switch (platform) {
    case "nodejs":
      nestId = 5;
      eggId = 15;
      dockerImage = "ghcr.io/parkervcp/yolks:nodejs_23";
      startupCmd =
        "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f \\/home\\/container\\/package.json ]; then \\/usr\\/local\\/bin\\/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then   vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr \";\" \"\\n\");   for line in $vars;  do export $line;  done fi;  \\/usr\\/local\\/bin\\/${CMD_RUN};";
      environment = {
        INST: "npm",
        USER_UPLOAD: "0",
        AUTO_UPDATE: "0",
        CMD_RUN: "npm start",
        JS_FILE: "index.js",
      };
      break;
    case "linux":
      nestId = 6;
      eggId = 17;
      dockerImage = "ghcr.io/parkervcp/games:samp";
      startupCmd = "./samp03svr";
      environment = { MAX_PLAYERS: max_players };
      voicePort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
      break;
    case "windows":
      nestId = 6;
      eggId = 16;
      dockerImage = "hcgcloud/pterodactyl-images:ubuntu-wine";
      startupCmd = "wine64 ./samp-server.exe";
      environment = { MAX_PLAYERS: max_players };
      voicePort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
      break;
    default:
      return res.status(400).json({ error: "Platform tidak valid." });
  }
  try {
    let user;
    let password = null;
    if (userId) {
      const userResponse = await axios.get(
        `${PTERO_DOMAIN}/api/application/users/${userId}`,
        { headers: applicationHeaders }
      );
      user = userResponse.data.attributes;
    } else {
      const username =
        serverName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() +
        Math.floor(Math.random() * 1000);
      const email = `${username}@example.com`;
      password = crypto.randomBytes(12).toString("base64");
      const firstName = username;
      const lastName = "User";
      user = await createPterodactylUser(username, email, password, firstName, lastName);
    }
    const server = await createPterodactylServer(
      serverName,
      user.id,
      nestId,
      eggId,
      dockerImage,
      startupCmd,
      parseInt(ram),
      parseInt(disk),
      parseInt(cpu),
      environment
    );
    const responseData = { user, server };
    if (password) {
      responseData.credentials = {
        password: password,
        login_url: PTERO_DOMAIN,
      };
      await User.findByIdAndUpdate(
        req.session.user.id,
        {
          $push: {
            paneldata: {
              username: user.username,
              password: password,
              domain: PTERO_DOMAIN,
              tanggal: moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss"),
            },
          },
        },
        { new: true }
      );
    }
    if (voicePort) responseData.voicePort = voicePort;
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in /reseller/cpanel:", error);
    res.status(500).json({ error: error.message });
  }
});


router.get("/add/user", isLoggedIn, checkRole("pt"), async (req, res) => {
  try {
    const { username, password, role } = req.query;
    if (!username || !password || !role) {
      return res.status(400).json({ status: false, msg: "Field tidak lengkap" });
    }
    const allowedRoles = ["reseller", "admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ status: false, msg: "Role tidak valid" });
    }
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ status: false, msg: "Username sudah ada" });
    }
    const newUser = new User({ username, password, role });
    await newUser.save();
    res.json({ status: true, msg: "User berhasil dibuat", data: { username, role } });
  } catch (err) {
    res.status(500).json({ status: false, msg: "Terjadi kesalahan server" });
  }
});

module.exports = router;

