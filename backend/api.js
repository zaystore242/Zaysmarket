const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment-timezone");
const axios = require("axios");
const cloudscraper = require("cloudscraper");
const qs = require("querystring");
const router = express.Router();

const {
  createPterodactylUser,
  createPterodactylServer,
} = require("../lib/function");
const { domain, atlakey, apikey } = require("../setting");
const PTERO_DOMAIN = domain;
const PTERO_APPLICATION_API_KEY = apikey
const API_KEY = atlakey;

const MONGO_URI = "mongodb+srv://gini:ggoktkkyoAnfTF0O@hiro.pwhagfj.mongodb.net/dalangstore?retryWrites=true&w=majority&appName=Hiro";
const User = mongoose.model("User");

const applicationHeaders = {
    'Authorization': `Bearer ${PTERO_APPLICATION_API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

router.get("/create/panel", async (req, res) => {
    try {
        const { serverName, userId, size, platform, max_players, id } = req.query;
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: formData
        });
        const apiRes = JSON.parse(response);
        if (!apiRes.status || apiRes.data.status !== "success") {
            return res.status(400).json({ status: false, msg: "Deposit belum berhasil", code: apiRes.code, data: apiRes.data });
        }
        if (!size || !platform || !serverName) {
            return res.status(400).json({ error: 'Data spesifikasi atau nama server tidak lengkap.' });
        }
        let ram, disk, cpu;
        switch (size) {
            case '1gb':
                ram = 1025;
                disk = 1025;
                cpu = 50;
                break;
            case '2gb':
                ram = 2025;
                disk = 2025;
                cpu = 100;
                break;
            case '3gb':
                ram = 3072;
                disk = 3072;
                cpu = 150;
                break;
            case '4gb':
                ram = 4096;
                disk = 4096;
                cpu = 200;
                break;
            case '5gb':
                ram = 5120;
                disk = 5120;
                cpu = 250;
                break;
            case '6gb':
                ram = 6144;
                disk = 6144;
                cpu = 300;
                break;
            case '7gb':
                ram = 7168;
                disk = 7168;
                cpu = 350;
                break;
            case '8gb':
                ram = 8192;
                disk = 8192;
                cpu = 400;
                break;
            case '9gb':
                ram = 9216;
                disk = 9216;
                cpu = 450;
                break;
            case '10gb':
                ram = 10240;
                disk = 10240;
                cpu = 500;
                break;
            case 'unli':
                ram = 0;
                disk = 0;
                cpu = 0;
                break;
            default:
                return res.status(400).json({ error: 'Ukuran server tidak valid.' });
        }
        let nestId, eggId, dockerImage, startupCmd;
        let environment = {};
        let voicePort = null;
        switch (platform) {
            case 'nodejs':
                nestId = 5;
                eggId = 15;
                dockerImage = "ghcr.io/parkervcp/yolks:nodejs_23";
                startupCmd = "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f \\/home\\/container\\/package.json ]; then \\/usr\\/local\\/bin\\/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then   vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr \";\" \"\\n\");   for line in $vars;  do export $line;  done fi;  \\/usr\\/local\\/bin\\/${CMD_RUN};";
                environment = {
                    INST: "npm",
                    USER_UPLOAD: "0",
                    AUTO_UPDATE: "0",
                    CMD_RUN: "npm start",
                    JS_FILE: "index.js"
                };
                break;
            case 'linux':
                nestId = 6;
                eggId = 17;
                dockerImage = "ghcr.io/parkervcp/games:samp";
                startupCmd = "./samp03svr";
                environment = {
                    MAX_PLAYERS: max_players,
                };
                voicePort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
                break;
            case 'windows':
                nestId = 6;
                eggId = 16;
                dockerImage = "hcgcloud/pterodactyl-images:ubuntu-wine";
                startupCmd = "wine64 ./samp-server.exe";
                environment = {
                    MAX_PLAYERS: max_players,
                };
                voicePort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
                break;
            default:
                return res.status(400).json({ error: 'Platform tidak valid.' });
        }
        let user;
        let password = null;
        if (userId) {
            const userResponse = await axios.get(`${PTERO_DOMAIN}/api/application/users/${userId}`, { headers: applicationHeaders });
            user = userResponse.data.attributes;
        } else {
            const username = serverName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + Math.floor(Math.random() * 1000);
            const email = `${username}@example.com`;
            password = crypto.randomBytes(12).toString('base64');
            const firstName = username;
            const lastName = 'User';
            user = await createPterodactylUser(username, email, password, firstName, lastName);
        }
        const server = await createPterodactylServer(serverName, user.id, nestId, eggId, dockerImage, startupCmd, ram, disk, cpu, environment);
        const responseData = {
            deposit: apiRes.data,
            user: user,
            server: server
        };
        if (password) {
            responseData.credentials = {
                password: password,
                login_url: PTERO_DOMAIN
            };
        }
        if (voicePort) {
            responseData.voicePort = voicePort;
        }
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error create/panel:", error.message);
        res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: error.message });
    }
});




router.post("/deposit/create", async (req, res) => {
  try {
    const { paket } = req.query;
    if (!paket) {
      return res.status(400).json({ status: false, msg: "Paket wajib diisi" });
    }
    let nominal;
    switch (paket) {
      case "1gb":
        nominal = 5200;
        break;
      case "2gb":
        nominal = 5200;
        break;
      case "3gb":
        nominal = 5200;
        break;
      case "4gb":
        nominal = 5200;
        break;
      case "5gb":
        nominal = 5200;
        break;
      case "6gb":
        nominal = 5200;
        break;
      case "7gb":
        nominal = 5200;
        break;
      case "8gb":
        nominal = 5200;
        break;
      case "9gb":
        nominal = 5200;
        break;
      case "10gb":
        nominal = 5200;
        break;
      case "unli":
        nominal = 1200;
        break;
      default:
        return res.status(400).json({ status: false, msg: "Paket tidak valid" });
    }
    const reff_id = "REF" + Date.now();
    const formData = qs.stringify({
      api_key: API_KEY,
      reff_id,
      nominal,
      type: "ewallet",
      metode: "qrisfast"
    });
    const response = await cloudscraper({
      method: "POST",
      url: "https://atlantich2h.com/deposit/create",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
        qr_string: apiRes.data.qr_string,
        qr_image: apiRes.data.qr_image,
        status: apiRes.data.status,
        created_at: apiRes.data.created_at,
        expired_at: apiRes.data.expired_at
      },
      code: apiRes.code
    });
  } catch (err) {
    console.error("Error deposit:", err.message);
    res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});


router.get("/deposit/status", async (req, res) => {
  try {
    const { id } = req.query;
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

router.get("/deposit/cancel", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ status: false, msg: "ID Deposit wajib diisi" });
    }
    const formData = qs.stringify({
      api_key: API_KEY,
      id
    });
    const response = await cloudscraper({
      method: "POST",
      url: "https://atlantich2h.com/deposit/cancel",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
      },
      body: formData
    });
    const apiRes = JSON.parse(response);
    return res.json({
      status: apiRes.status,
      data: {
        id: apiRes.data?.id,
        status: apiRes.data?.status,
        created_at: apiRes.data?.created_at
      },
      code: apiRes.code
    });
  } catch (err) {
    console.error("Error cancel deposit:", err.message);
    return res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});

router.get("/order/role", async (req, res) => {
  try {
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({ status: false, msg: "Role wajib diisi" });
    }

    let nominal = 0;
    switch (role) {
      case "reseller":
        nominal = 3200;
        break;
      case "admin":
        nominal = 5200;
        break;
      case "pt":
        nominal = 8200;
        break;
      default:
        return res.status(400).json({ status: false, msg: "Role tidak valid" });
    }

    const reff_id = "REF" + Date.now();

    const formData = qs.stringify({
      api_key: API_KEY,
      reff_id,
      nominal,
      type: "ewallet",
      metode: "qrisfast"
    });

    const response = await cloudscraper({
      method: "POST",
      url: "https://atlantich2h.com/deposit/create",
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
      role, 
      data: {
        id: apiRes.data.id,
        reff_id: apiRes.data.reff_id,
        nominal: apiRes.data.nominal,
        tambahan: apiRes.data.tambahan,
        fee: apiRes.data.fee,
        get_balance: apiRes.data.get_balance,
        qr_string: apiRes.data.qr_string,
        qr_image: apiRes.data.qr_image,
        status: apiRes.data.status,
        created_at: apiRes.data.created_at,
        expired_at: apiRes.data.expired_at
      },
      code: apiRes.code
    });
  } catch (err) {
    console.error("Error deposit:", err.message);
    res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});


router.get("/user/add", async (req, res) => {
  try {
    const { username, password, role, deposit_id } = req.query;

    if (!username || !password || !deposit_id) {
      return res.status(400).json({ 
        status: false, 
        msg: "Username, Password, dan Deposit ID wajib diisi" 
      });
    }

    const formData = qs.stringify({
      api_key: API_KEY,
      id: deposit_id
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

    if (!apiRes.status || apiRes.data.status !== "success") {
      return res.status(400).json({ 
        status: false, 
        msg: "Deposit belum sukses, tidak bisa membuat user",
        deposit_status: apiRes.data.status
      });
    }

    const newUser = new User({
      username,
      password,
      role: role && ["reseller", "admin", "pt"].includes(role) ? role : "reseller"
    });

    await newUser.save();

    res.json({ 
      status: true, 
      msg: "User berhasil ditambahkan", 
      deposit_status: apiRes.data.status,
      data: newUser 
    });
  } catch (err) {
    console.error("Error add user:", err.message);
    res.status(500).json({ 
      status: false, 
      msg: "Terjadi kesalahan", 
      error: err.message 
    });
  }
});


module.exports = router;
