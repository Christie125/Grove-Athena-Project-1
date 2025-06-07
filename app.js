require('dotenv').config();
const express = require("express");
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require('./db');

const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET

if (!sessionSecret) {
  console.error("Session secret is not set.");
  process.exit(1);
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
  })
);

// Initialise passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth strategy for passport
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
    },
    async (_, __, profile, done) => {
      const account = profile._json;
      let user = {};

      try {
        // Check if user exists in the database
        const currentUserQuery = await pool.query(
          "SELECT * FROM users WHERE google_id=$1",
          [account.sub]
        );

        if (currentUserQuery.rows.length === 0) {
          // Create new user if not found
          await pool.query(
            "INSERT INTO users (username, google_id, email) VALUES ($1, $2, $3)",
            [account.name, account.sub, account.email]
          );

          const id = await pool.query(
            "SELECT id FROM users WHERE google_id=$1", 
            [account.sub]
          );
          user = {
            id: id.rows[0].id,
            username: account.name,
            email: account.email,
          };
        } 
        
        else {
          // Use existing user
          user = {
            id: currentUserQuery.rows[0].id,
            username: currentUserQuery.rows[0].username,
            email: currentUserQuery.rows[0].email,
          };
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Authentication routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/habits");
  }
);

// only accessible when authenticated
app.get("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.id;

    try {
      const userPoints = await pool.query("SELECT points FROM points WHERE user_id = $1", [userId]);
      const pointsValue = userPoints.rows.length > 0 ? userPoints.rows[0].points : 0;

      res.render('profile', {
        username: req.user.username,
        email: req.user.email,
        points: pointsValue
      });

    } catch (error) {
      console.error("Error fetching points for profile:", error);
      res.status(500).send("Internal Server Error");
    }

  } else {
    res.redirect("/login");
  }
});


app.get("/habits", async (req, res) => {
  if (req.isAuthenticated()) {
    
    const userId = req.user.id;
    
    try {
      const result = await pool.query("SELECT * FROM habits WHERE user_id = $1", [userId]);
      const userHabits = result.rows;
      const userPoints = await pool.query("SELECT points FROM points WHERE user_id = $1", [userId]);
      if (userPoints.rows.length === 0) {
        await pool.query("INSERT INTO points (user_id, points) VALUES ($1, 0)", [userId]);
      }
      const pointsValue = userPoints.rows.length > 0 ? userPoints.rows[0].points : 0;
      res.render("habits", { habits: userHabits, points: pointsValue});  // Passing habits to EJS
    } catch (err) {
      console.error("Error fetching habits:", err);
      res.status(500).send("Internal Server Error");
    }

  } else {
    res.redirect("/login");
  }
});

app.post("/add-habit", (req, res) => {
  if (req.isAuthenticated()) {
    const { name, description, frequency } = req.body;
    const userId = req.user.id;

    if (name && description && frequency !== undefined) {
      if (
        typeof name === "string" &&
        name.length < 30 &&
        //name does not contain special characters
        /^[a-zA-Z0-9 ]+$/.test(name) &&
        typeof description === "string" &&
        description.length < 30 &&
        typeof frequency === "number" &&
        Number(frequency) > 0 &&
        Number(frequency) < 15
      ) {
        pool.query(
          "INSERT INTO habits (user_id, habit, habit_note, how_often_habit) VALUES ($1, $2, $3, $4) RETURNING *",
          [userId, name, description, frequency],
          (err, result) => {
            if (err) {
              console.error("Error adding habit:", err);
              return res.status(500).send("Error adding habit. Please try again.");
            }
            res.status(200).json({ message: "Habit added successfully", habit: result.rows[0] });
          }
        );
      }
      else {
        res.status(400).send("Invalid input. Please check your data and make sure that your input is not overly long and does not contain special characters.");
      }
    } else {
      res.status(400).send("Please fill in all fields.");
    }
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.post("/delete-habit", (req, res) => {
  if (req.isAuthenticated()) {
    const { habitId } = req.body;
    const userId = req.user.id;

    pool.query(
      "DELETE FROM habits WHERE habit = $1 AND user_id = $2",
      [habitId, userId],
      (err, result) => {
        if (err) {
          console.error("Error deleting habit:", err);
          return res.status(500).send("Error deleting habit. Please try again.");
        }
         if (result.rowCount === 0) {
                    // This means no habit matching the name AND user_id was found
                    console.log(`No habit found with name: "${habitId}" for user: ${userId}. It might have already been deleted or name mismatch.`);
                    return res.status(404).json({ message: "Habit not found or you don't have permission to delete it." });
                }
        res.status(200).json({ message: "Habit deleted successfully" });
      }
    );
  } else {
    res.status(401).send("Unauthorized");
  }
})

app.post("/update-points", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userId = req.user.id;
      // Increment points by 1 for the authenticated user
      await pool.query(
        "UPDATE points SET points = points + 1 WHERE user_id = $1",
        [userId]
      );
      res.status(200).json({ message: "Points updated successfully" });
    } catch (error) {
      console.error("Error updating points:", error);
      return res.status(500).send("Error updating points. Please try again.");
    }
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.get("/get-points", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const result = await pool.query("SELECT points FROM points WHERE user_id = $1", [req.user.id]);
      const points = result.rows[0]?.points ?? 0;
      res.json({ points });
    } catch (err) {
      console.error("Error fetching points:", err);
      res.status(500).json({ error: "Failed to get points" });
    }
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/leaderboard", async (req, res) => {
  if (req.isAuthenticated()) {
     try {
      const userId = req.user.id;
      const userPoints = await pool.query("SELECT points FROM points WHERE user_id = $1", [userId]);
      const pointsValue = userPoints.rows.length > 0 ? userPoints.rows[0].points : 0;

      res.render('leaderboard', {
        points: pointsValue
      });

    } catch (error) {
      console.error("Error fetching points for profile:", error);
      res.status(500).send("Internal Server Error");
    }
  }
  else {
    res.redirect("/login");
  }
});


app.get("/getleaderboard" , async (req, res) => {
  if (req.isAuthenticated()) {
    try {
 // Fetch top users by points
    pool.query(
      "SELECT username, points FROM users JOIN points ON users.id = points.user_id ORDER BY points DESC LIMIT 10",
      (err, result) => {
        if (err) {
          console.error("Error fetching leaderboard:", err);
          return res.status(500).send("Error fetching leaderboard. Please try again.");
        }
        const leaderboard = result.rows;
        res.json(leaderboard);
      }
    );
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  try {
    req.logout(() => {
      req.session.destroy();
      res.clearCookie('connect.sid');
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Login page route
app.get('/login', (req, res) => {
  res.render('login');
});

// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});