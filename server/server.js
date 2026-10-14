
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = 9000;

app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.MONGO_URI);

let users, projects, memberships;

function validId(id) {
    return typeof id === "string" && ObjectId.isValid(id);
}

async function connectDatabase() {
    await client.connect();

    const db = client.db("pa2");
    users = db.collection("users");
    projects = db.collection("Projects");
    memberships = db.collection("ProjectMemberships");

    await users.createIndex({ username: 1 }, { unique: true });
    await memberships.createIndex(
        { project_id: 1, user_id: 1 },
        { unique: true }
    );

    console.log("Connected to MongoDB");
}

app.get("/", (req, res) => {
    res.json({ message: "Server is running" });
});

// SIGNUP
app.post("/signup", async (req, res) => {
    try {
        const { f_name, l_name, username, password } = req.body;

        if (!f_name || !l_name || !username || !password) {
            return res.status(400).json({
                message: "All signup fields are required"
            });
        }

        await users.insertOne({ f_name, l_name, username, password });

        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const user = await users.findOne({ username });

        if (!user || user.password !== password) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        res.json({ message: "Login successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET REGISTERED USERS
app.get("/users", async (req, res) => {
    try {
        const result = await users.find(
            {},
            { projection: { f_name: 1, l_name: 1, username: 1 } }
        ).toArray();

        res.json(result.map(user => ({
            _id: user._id,
            name: `${user.f_name} ${user.l_name}`,
            username: user.username
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not retrieve users" });
    }
});

// CREATE PROJECT
app.post("/projects", async (req, res) => {
    try {
        const { name, description, status, project_lead_id } = req.body;

        if (!name?.trim() || !description?.trim() ||
            !status || !project_lead_id) {
            return res.status(400).json({
                message: "All project fields are required"
            });
        }

        if (!["Planning", "Active", "Completed"].includes(status)) {
            return res.status(400).json({ message: "Invalid project status" });
        }

        if (!validId(project_lead_id)) {
            return res.status(400).json({ message: "Invalid Project Lead ID" });
        }

        const lead = await users.findOne({
            _id: new ObjectId(project_lead_id)
        });

        if (!lead) {
            return res.status(404).json({
                message: "The selected Project Lead does not exist"
            });
        }

        const result = await projects.insertOne({
            name: name.trim(),
            description: description.trim(),
            status,
            project_lead_id: lead._id
        });

        try {
            await memberships.insertOne({
                project_id: result.insertedId,
                user_id: lead._id
            });
        } catch (error) {
            await projects.deleteOne({ _id: result.insertedId });
            throw error;
        }

        res.status(201).json({ message: "Project created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not create project" });
    }
});

// VIEW PROJECTS AND PROJECT LEADS
app.get("/projects", async (req, res) => {
    try {
        const result = await projects.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "project_lead_id",
                    foreignField: "_id",
                    as: "lead"
                }
            },
            { $unwind: "$lead" },
            {
                $project: {
                    name: 1,
                    description: 1,
                    status: 1,
                    project_lead_id: 1,
                    lead_name: {
                        $concat: ["$lead.f_name", " ", "$lead.l_name"]
                    },
                    lead_username: "$lead.username"
                }
            },
            { $sort: { name: 1 } }
        ]).toArray();

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not retrieve projects" });
    }
});

// VIEW PROJECT MEMBERS
app.get("/projects/:projectId/members", async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!validId(projectId)) {
            return res.status(400).json({ message: "Invalid project ID" });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const result = await memberships.aggregate([
            { $match: { project_id: project._id } },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: 0,
                    user_id: "$user._id",
                    name: {
                        $concat: ["$user.f_name", " ", "$user.l_name"]
                    },
                    username: "$user.username",
                    is_lead: {
                        $eq: ["$user._id", project.project_lead_id]
                    }
                }
            },
            { $sort: { username: 1 } }
        ]).toArray();

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not retrieve members" });
    }
});

// ADD PROJECT MEMBER
app.post("/projects/:projectId/members", async (req, res) => {
    try {
        const { projectId } = req.params;
        const { user_id } = req.body;

        if (!validId(projectId) || !validId(user_id)) {
            return res.status(400).json({ message: "Invalid project or user ID" });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const user = await users.findOne({ _id: new ObjectId(user_id) });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const existing = await memberships.findOne({
            project_id: project._id,
            user_id: user._id
        });

        if (existing) {
            return res.status(409).json({
                message: "This user is already a member of the project"
            });
        }

        await memberships.insertOne({
            project_id: project._id,
            user_id: user._id
        });

        res.status(201).json({ message: "Member added successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "This user is already a member of the project"
            });
        }
        console.error(error);
        res.status(500).json({ message: "Could not add member" });
    }
});

// REMOVE PROJECT MEMBER
app.delete("/projects/:projectId/members/:userId", async (req, res) => {
    try {
        const { projectId, userId } = req.params;

        if (!validId(projectId) || !validId(userId)) {
            return res.status(400).json({ message: "Invalid project or user ID" });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const user = await users.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (project.project_lead_id.equals(user._id)) {
            return res.status(400).json({
                message: "The Project Lead cannot be removed from the project"
            });
        }

        const result = await memberships.deleteOne({
            project_id: project._id,
            user_id: user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "This user is not a member of the project"
            });
        }

        res.json({ message: "Member removed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not remove member" });
    }
});

connectDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error("Could not connect to MongoDB", error);
        process.exit(1);
    });
