const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment-timezone");
const axios = require("axios");
const cloudscraper = require("cloudscraper");
const qs = require("querystring");
const router = express.Router();

const MONGO_URI = "mongodb+srv://gini:ggoktkkyoAnfTF0O@hiro.pwhagfj.mongodb.net/dalangstore?retryWrites=true&w=majority&appName=Hiro";
const User = mongoose.model("User");

const {
  createPterodactylUser,
  createPterodactylServer,
} = require("../lib/function");
const { domain, atlakey, apikey } = require("../setting");
const PTERO_DOMAIN = domain;
const PTERO_APPLICATION_API_KEY = apikey
const API_KEY = atlakey;

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

const applicationHeaders = {
    'Authorization': `Bearer ${PTERO_APPLICATION_API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

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

router.get('/api/users', isLoggedIn, checkRole("owner"),  async (req, res) => {
    try {
        const response = await axios.get(`${PTERO_DOMAIN}/api/application/users`, { headers: applicationHeaders });
        const users = response.data.data.map(user => user.attributes);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/api/users/:id', isLoggedIn, checkRole("owner"),  async (req, res) => {
    const { id } = req.params;
    try {
        await axios.delete(`${PTERO_DOMAIN}/api/application/users/${id}`, { headers: applicationHeaders });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/servers', isLoggedIn, checkRole("owner"),  async (req, res) => {
    try {
        const response = await axios.get(`${PTERO_DOMAIN}/api/application/servers`, { headers: applicationHeaders });

        const servers = response.data.data.map(server => {
            const attr = server.attributes;
            return {
                id: attr.id,
                name: attr.name,
                ram: attr.limits.memory,
                disk: attr.limits.disk,
                cpu: attr.limits.cpu,
                image: attr.container.image,
                updated_at: attr.updated_at,
                created_at: attr.created_at
            };
        });

        res.status(200).json(servers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/api/servers/:id', isLoggedIn, checkRole("owner"),  async (req, res) => {
    const { id } = req.params;
    try {
        await axios.delete(`${PTERO_DOMAIN}/api/application/servers/${id}`, { headers: applicationHeaders });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



router.get("/add/user", isLoggedIn, checkRole("owner"), async (req, res) => {
  try {
    const { username, password, role } = req.query;
    if (!username || !password || !role) {
      return res.status(400).json({ status: false, msg: "Field tidak lengkap" });
    }
    const allowedRoles = ["reseller", "admin", "pt", "owner"];
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

router.get("/data/users", isLoggedIn, checkRole("owner"), async (req, res) => {
  try {
    const users = await User.find().select("-password"); // sembunyikan password
    res.json({ status: true, data: users });
  } catch (err) {
    console.error("Error GET /api/users:", err);
    res.status(500).json({ status: false, msg: "Gagal ambil data user" });
  }
});

router.delete("/dell/users/:username", isLoggedIn, checkRole("owner"), async (req, res) => {
  try {
    const { username } = req.params;
    const deleted = await User.findOneAndDelete({ username });

    if (!deleted) {
      return res.status(404).json({ status: false, msg: "User tidak ditemukan" });
    }

    res.json({ status: true, msg: `User ${username} berhasil dihapus` });
  } catch (err) {
    console.error("Error DELETE /api/users:", err);
    res.status(500).json({ status: false, msg: "Gagal hapus user" });
  }
}); 
module.exports = router;
