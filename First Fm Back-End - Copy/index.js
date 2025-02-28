import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express, { request, response } from "express"
import dotenv from 'dotenv';
import cors from "cors"
import { neon } from "@neondatabase/serverless";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const router = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

const DATABASE_URL = "postgresql://neondb_owner:npg_KvCdAyDN3bc8@ep-spring-voice-a8itu915-pooler.eastus2.azure.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "faran82.h@gmail.com",
    pass: "iqsratauxqmwrqqd",
  },
  // iqsr atau xqmw rqqd
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).send("All fields are required");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await sql`
      INSERT INTO Users (username, email, password) 
      VALUES (${username}, ${email}, ${hashedPassword}) 
      RETURNING id, username, email;
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).send("Error signing up user");
  }
  try {
      const info = await transporter.sendMail({
        from: '"Your App" <faran82.h@gmail.com>', 
        to: email,
        subject: "Welcome to Our Platform!",
        text: `Hello ${username},\n\nThank you for signing up! We’re excited to have you on board.`,
        html: `<h1>Welcome, ${username}!</h1><p>Thank you for signing up! We're excited to have you on board.</p>`,
      });

      console.log("Welcome email sent:", info.messageId);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }
});

app.post('/login', async (request, response) => {
  const { email, password } = request.body;
  try {
      if (!email || !password) {
          return response.status(400).json({ error: "Missing required fields." });
      }
      
      const result = await sql`SELECT * FROM users WHERE email=${email};`
      if (result.length === 0) {
          return response.status(401).json({ error: "Invalid email or password" });
      }
      
      const isValid = await bcrypt.compare(password, result[0].password);
      if (!isValid) {
          return response.status(401).json({ error: "Invalid username or password" });
      }
      const user = { id: result[0].id, username: result[0].username, email: result[0].email}
      const accessToken = jwt.sign(user, "mySuperSecretKey123", { expiresIn: '1h' })
      response.status(200).json({ accessToken: accessToken, user: user });
  } catch (error) {
      response.status(500).json({ error: "Internal server error." });
  }
});

app.put("/profile", async (request, response) => {
  const { email, username } = request.body;

  if (!email || !username) {
    return res.status(400).json({ error: true, message: "Email and username are required" });
  }

  try {
    const result = await sql`
      SELECT * FROM users WHERE email = ${email};
    `;

    if (result.length === 0) {
      return response.status(404).json({ error: true, message: "User not found" });
    }

    const updatedUser = await sql`
      UPDATE users
      SET username = ${username}
      WHERE email = ${email}
      RETURNING username, email;
    `;

    response.status(200).json({ message: "Profile updated successfully", user: updatedUser[0] });
  } catch (error) {
    res.status(500).json({ error: true, message: "Error updating profile" });
  }
});

app.get("/album", async (request, response) => {
  try {
    const albums = await sql`SELECT * FROM album ORDER BY rank;`;
    response.send(albums);
  } catch (error) {
    console.error('Error while fetching albums:', error);
    response.status(500).send({ error: 'An error occurred while fetching albums.' });
  }
});

app.get("/tweet", async(request,response) => {
  try {
    const tweets = await sql`SELECT * FROM tweet ORDER BY publish_datetime DESC;`;
    response.send(tweets);
  } catch (error) {
    console.error('Error while fetching tweets:', error);
    response.status(500).send({ error: 'An error occurred while fetching tweets.' });
  }
});

app.get("/tweet/:category", async (request, response) => {
  const category = request.params.category;
  try {
    const tweets = await sql`
      SELECT * FROM tweet WHERE category ILIKE ${'%' + category + '%'}
    `;
    response.send(tweets);
  } catch (error) {
    console.error('Error while fetching tweets:', error);
    response.status(500).send({ error: 'An error occurred while fetching tweets.' });
  }
});

app.post("/tweet", async (request, response) => {
    try {
      const { author, content, category, publishDate } =
        request.body;
      const created = await sql`
        INSERT INTO tweet (author, content, category, publish_datetime) 
        VALUES (${author}, ${content}, ${category}, ${publishDate})
        RETURNING *;
      `;
      response.status(201).json(created);
    } catch (error) {
      console.error("Error adding recipe:", error.message);
      response.status(500).json({ message: "Internal Server Error" });
    }
  });

const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
