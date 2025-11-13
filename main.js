const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const MONGO_URI = "mongodb+srv://Dalangs:Dalangs@cluster0.xagdidt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(session({
  secret: "kurumi_sayang",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
}));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["reseller", "admin", "pt", "owner"], 
    default: "reseller" 
  },
  paneldata: [
    { 
      username: String, 
      password: String, 
      domain: String, 
      tanggal: String 
    }
  ],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model("User", userSchema);

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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/order-panel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order-panel.html"));
});

app.get("/order-role", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order-role.html"));
});

app.get("/user/add", async (req, res) => {
  try {
    const { username, password, role } = req.query;

    if (!username || !password) {
      return res.status(400).json({ status: false, msg: "Username & Password wajib diisi" });
    }

    const newUser = new User({
      username,
      password,
      role: role || "user"
    });

    await newUser.save();
    res.json({ status: true, msg: "User berhasil ditambahkan", data: newUser });
  } catch (err) {
    console.error("Error add user:", err.message);
    res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});



app.get("/login", (req, res) => {
  if (req.session.user) {
    switch (req.session.user.role) {
      case "reseller":
        return res.redirect("/reseller");
      case "admin":
        return res.redirect("/admin");
      case "pt":
        return res.redirect("/pt");
      case "owner":
        return res.redirect("/owner");
    }
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).send("Username atau password salah");
  req.session.user = { id: user._id, username: user.username, role: user.role };
  switch (user.role) {
    case "reseller":
      return res.redirect("/reseller");
    case "admin":
      return res.redirect("/admin");
    case "pt":
      return res.redirect("/pt");
    case "owner":
      return res.redirect("/owner");
    default:
      return res.redirect("/");
  }
});

app.get("/profile", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User tidak ditemukan." });

    res.json({
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      paneldata: user.paneldata || [],
    });
  } catch (err) {
    console.error("Error GET /profile:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});


app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

//=====[ RESELLER RUTE ]=====//
app.get("/reseller", isLoggedIn, checkRole("reseller"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reseller", "dashboard.html"));
});

app.get("/create-panel", isLoggedIn, checkRole("reseller"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reseller", "cpanel.html"));
});

app.get("/upgrade", isLoggedIn, checkRole("reseller"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reseller", "upgrade.html"));
});

//=====[ ADMIN RUTE ]=====//
app.get("/admin", isLoggedIn, checkRole("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "dashboard.html"));
});

app.get("/admin/create-panel", isLoggedIn, checkRole("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "cpanel.html"));
});

app.get("/admin/upgrade", isLoggedIn, checkRole("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "upgrade.html"));
});

app.get("/admin/add-user", isLoggedIn, checkRole("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "adduser.html"));
});

//=====[ PT RUTE ]=====//
app.get("/pt", isLoggedIn, checkRole("pt"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pt", "dashboard.html"));
});

app.get("/pt/create-panel", isLoggedIn, checkRole("pt"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pt", "cpanel.html"));
});

app.get("/pt/add-user", isLoggedIn, checkRole("pt"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pt", "adduser.html"));
});

//=====[ OWNER RUTE ]=====//
app.get("/owner", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "dashboard.html"));
});

app.get("/owner/create-panel", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "cpanel.html"));
});

app.get("/owner/create-user", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "adduser.html"));
});

app.get("/owner/list-user", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "listuser.html"));
});

app.get("/owner/list-server", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "listsrv.html"));
});

app.get("/owner/data-user", isLoggedIn, checkRole("owner"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "owner", "datauser.html"));
});

const ownerRouter = require("./backend/owner");
app.use("/owner", ownerRouter);

const ptRouter = require("./backend/pt");
app.use("/pt", ptRouter);

const AdmRouter = require("./backend/admin");
app.use("/admin", AdmRouter);

const SellRouter = require("./backend/reseller");
app.use("/reseller", SellRouter);

const ApiRouter = require("./backend/api");
app.use("/api", ApiRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
