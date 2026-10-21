import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword, emailValue, passwordValue } from "./security.mjs";

export function openDatabase(config) {
  if (config.dbPath !== ":memory:")
    mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec("PRAGMA busy_timeout=5000");
  if (
    db.prepare("SELECT value FROM metadata WHERE key='schema_version'").get()
      ?.value !== "1"
  ) {
    db.prepare(
      "INSERT OR IGNORE INTO metadata VALUES ('schema_version','1')",
    ).run();
  }
  const seedMode = db
    .prepare("SELECT value FROM metadata WHERE key='seed_mode'")
    .get();
  if (!config.demo && seedMode?.value === "demo") {
    db.close();
    throw new Error(
      "This database contains demo accounts. Use a fresh DB_PATH for production.",
    );
  }
  if (!seedMode) {
    if (!config.demo && (!config.adminEmail || !config.adminPassword)) {
      db.close();
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD for first production boot.",
      );
    }
    db.exec("BEGIN");
    try {
      if (config.demo) seedDemo(db);
      else {
        const email = emailValue(config.adminEmail),
          password = passwordValue(config.adminPassword);
        db.prepare(
          "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          "Administrator",
          email,
          hashPassword(password),
          "admin",
          Date.now(),
        );
      }
      db.prepare("INSERT INTO metadata VALUES (?,?)").run(
        "seed_mode",
        config.demo ? "demo" : "production",
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.close();
      throw e;
    }
  }
  return db;
}

function seedDemo(db) {
  const now = Date.now();
  const insertUser = db.prepare(
    "INSERT INTO users (id,name,email,phone,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)",
  );
  insertUser.run(
    "demo-customer",
    "Alex Morgan",
    "customer@gleam.local",
    "+919876543210",
    hashPassword("GleamDemo123!"),
    "customer",
    now,
  );
  insertUser.run(
    "demo-admin",
    "Gleam Admin",
    "admin@gleam.local",
    "+919876543211",
    hashPassword("AdminDemo123!"),
    "admin",
    now,
  );
  db.prepare("INSERT INTO vehicles VALUES (?,?,?,?,?,?)").run(
    "demo-car",
    "demo-customer",
    "Hyundai i20",
    "UK07 AB 1234",
    "hatchback",
    "Polar White",
  );
  const providers = [
    [
      "proglow",
      "Proglow Auto Spa",
      "Rajpur Road",
      "86 Rajpur Road, Dehradun, Uttarakhand",
      30.3449,
      78.0582,
      "A fresh finish, down to the last detail. Our flagship studio combines careful hand washing with thoughtful interior care. Relax in the lounge while our crew gives your car a little extra love.",
      "+919900001001",
      9,
      19,
      2,
      "wash",
      "#f65349",
      ["Hand wash", "Customer lounge", "Free Wi-Fi", "Parking"],
    ],
    [
      "wash-club",
      "The Wash Club",
      "Dalanwala",
      "24 EC Road, Dalanwala, Dehradun, Uttarakhand",
      30.3256,
      78.0549,
      "Your neighbourhood stop for everyday shine. From a quick exterior refresh to an all-round deep clean, our friendly crew makes car care simple.",
      "+919900001002",
      8,
      20,
      2,
      "studio",
      "#809d94",
      ["Express service", "Eco products", "Waiting lounge", "Parking"],
    ],
    [
      "foam-finish",
      "Foam & Finish",
      "Ballupur",
      "42 Ballupur Road, Dehradun, Uttarakhand",
      30.3354,
      78.0121,
      "Slow, careful, satisfying car care. We specialise in foam washes and interior detailing with attention to those easy-to-miss corners.",
      "+919900001003",
      9,
      18,
      1,
      "foam",
      "#6c7c9c",
      ["Foam wash", "Interior care", "Parking", "Hand wash"],
    ],
    [
      "spark-studio",
      "Spark Auto Studio",
      "Sahastradhara Road",
      "18 Sahastradhara Road, Dehradun, Uttarakhand",
      30.3481,
      78.0761,
      "A complete refresh for your favourite ride. Explore thoughtful detailing packages, protective finishes and everyday wash services in our modern studio.",
      "+919900001004",
      9,
      19,
      2,
      "detail",
      "#c49b6f",
      ["Detailing experts", "Customer lounge", "Free Wi-Fi", "Parking"],
    ],
  ];
  const providerStmt = db.prepare(
    "INSERT INTO providers (id,name,area,address,lat,lng,description,phone,opens,closes,capacity,image,accent,features) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const serviceStmt = db.prepare(
    "INSERT INTO services VALUES (?,?,?,?,?,?,?,?,1)",
  );
  const catalog = [
    [
      "signature",
      "Signature wash",
      "Exterior",
      "The everyday reset your car deserves.",
      499,
      30,
      ["Foam hand wash", "Wheel & tyre clean", "Microfibre dry"],
    ],
    [
      "interior",
      "Interior refresh",
      "Interior",
      "A clean cabin. A clearer head.",
      699,
      60,
      ["Deep vacuum", "Dashboard wipe", "Glass cleaning"],
    ],
    [
      "full-detail",
      "Complete detailing",
      "Detailing",
      "Our most-loved inside-out treatment.",
      1499,
      90,
      [
        "Signature wash",
        "Interior refresh",
        "Upholstery spot clean",
        "Tyre dressing",
      ],
    ],
    [
      "wax",
      "Gloss & protect",
      "Protection",
      "Bring back that just-detailed glow.",
      999,
      60,
      ["Exterior wash", "Hand-applied wax", "Paint protection finish"],
    ],
  ];
  providers.forEach((p, i) => {
    providerStmt.run(...p.slice(0, 13), JSON.stringify(p[13]));
    catalog.forEach((s, j) =>
      serviceStmt.run(
        `${p[0]}-${s[0]}`,
        p[0],
        s[1],
        s[2],
        s[3],
        s[4] + i * 50,
        s[5],
        JSON.stringify(s[6]),
      ),
    );
    [
      [
        "Riya Sharma",
        5,
        "A lovely clean, right on time. The team took real care of the little details.",
      ],
      [
        "Arjun Mehta",
        5,
        "Easy booking and a spotless finish. The waiting area is a nice touch.",
      ],
      [
        "Neha Kapoor",
        4,
        "Good value and friendly service. My car feels fresh again.",
      ],
    ].forEach((r, j) =>
      db
        .prepare("INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,?)")
        .run(
          randomUUID(),
          p[0],
          null,
          null,
          r[0],
          r[1],
          r[2],
          1,
          now - (j + 1) * 86400000,
        ),
    );
  });
  db.prepare("INSERT INTO favorites VALUES (?,?)").run(
    "demo-customer",
    "proglow",
  );
  db.prepare("INSERT INTO notifications VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(),
    "demo-customer",
    "Your next fresh start",
    "Welcome to Gleam. Add your vehicle, pick a studio and find your perfect wash.",
    null,
    0,
    now,
  );
}
