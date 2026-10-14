
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:9000";

function App() {
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState("");
    const [members, setMembers] = useState([]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("Planning");
    const [leadId, setLeadId] = useState("");
    const [memberId, setMemberId] = useState("");

    async function request(path, options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }

        return data;
    }

    async function loadUsers() {
        setUsers(await request("/users"));
    }

    async function loadProjects() {
        const data = await request("/projects");
        setProjects(data);

        if (selectedProject && !data.some(
            project => project._id === selectedProject
        )) {
            setSelectedProject("");
            setMembers([]);
        }
    }

    async function loadMembers(projectId) {
        if (!projectId) {
            setMembers([]);
            return;
        }

        setMembers(await request(`/projects/${projectId}/members`));
    }

    useEffect(() => {
        async function initialize() {
            try {
                await Promise.all([loadUsers(), loadProjects()]);
            } catch (err) {
                showMessage(err.message, true);
            }
        }

        initialize();
    }, []);

    function showMessage(text, isError = false) {
        setMessage(text);
        setError(isError);
    }

    async function createProject(event) {
        event.preventDefault();

        try {
            await request("/projects", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    description,
                    status,
                    project_lead_id: leadId
                })
            });

            setName("");
            setDescription("");
            setStatus("Planning");
            setLeadId("");
            showMessage("Project created successfully!");
            await loadProjects();
            await loadUsers();
        } catch (err) {
            showMessage(err.message, true);
        }
    }

    async function addMember(event) {
        event.preventDefault();

        if (!selectedProject || !memberId) {
            showMessage("Select a project and user first.", true);
            return;
        }

        try {
            const data = await request(
                `/projects/${selectedProject}/members`,
                {
                    method: "POST",
                    body: JSON.stringify({ user_id: memberId })
                }
            );

            showMessage(data.message);
            await loadMembers(selectedProject);
        } catch (err) {
            showMessage(err.message, true);
        }
    }

    async function removeMember(userId) {
        try {
            const data = await request(
                `/projects/${selectedProject}/members/${userId}`,
                { method: "DELETE" }
            );

            showMessage(data.message);
            await loadMembers(selectedProject);
        } catch (err) {
            showMessage(err.message, true);
        }
    }

    return (
        <main className="app">
            <h1>Project Management System</h1>
            <p>Create projects and manage project memberships.</p>

            {message && (
                <p role="status" style={{
                    color: error ? "crimson" : "green",
                    fontWeight: "bold"
                }}>
                    {message}
                </p>
            )}

            <section>
                <h2>Create Project</h2>
                <form onSubmit={createProject}>
                    <label>
                        Project Name
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Description
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Status
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option>Planning</option>
                            <option>Active</option>
                            <option>Completed</option>
                        </select>
                    </label>

                    <label>
                        Project Lead
                        <select
                            value={leadId}
                            onChange={e => setLeadId(e.target.value)}
                            required
                        >
                            <option value="">Select a registered user</option>
                            {users.map(user => (
                                <option key={user._id} value={user._id}>
                                    {user.name} ({user.username})
                                </option>
                            ))}
                        </select>
                    </label>

                    <button type="submit">Create Project</button>
                </form>
            </section>

            <section>
                <h2>Projects</h2>
                <button onClick={() => {
                    loadProjects().catch(err => showMessage(err.message, true));
                }}>
                    Refresh Projects
                </button>

                {projects.length === 0 && <p>No projects created yet.</p>}

                {projects.map(project => (
                    <article key={project._id} className="project-card">
                        <h3>{project.name}</h3>
                        <p>{project.description}</p>
                        <p><strong>Status:</strong> {project.status}</p>
                        <p>
                            <strong>Project Lead:</strong>{" "}
                            {project.lead_name} ({project.lead_username})
                        </p>
                        <button onClick={() => {
                            setSelectedProject(project._id);
                            setMemberId("");
                            loadMembers(project._id).catch(
                                err => showMessage(err.message, true)
                            );
                        }}>
                            Manage Members
                        </button>
                    </article>
                ))}
            </section>

            <section>
                <h2>Manage Project Memberships</h2>

                <label>
                    Select Project
                    <select
                        value={selectedProject}
                        onChange={e => {
                            const id = e.target.value;
                            setSelectedProject(id);
                            setMemberId("");
                            loadMembers(id).catch(
                                err => showMessage(err.message, true)
                            );
                        }}
                    >
                        <option value="">Select a project</option>
                        {projects.map(project => (
                            <option key={project._id} value={project._id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </label>

                {selectedProject && (
                    <>
                        <h3>Current Members</h3>

                        {members.length === 0 && <p>No members found.</p>}

                        <ul>
                            {members.map(member => (
                                <li key={member.user_id}>
                                    {member.name} ({member.username})
                                    {member.is_lead ? (
                                        <strong> — Project Lead (cannot remove)</strong>
                                    ) : (
                                        <button
                                            onClick={() => removeMember(member.user_id)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <form onSubmit={addMember}>
                            <label>
                                Add Registered User
                                <select
                                    value={memberId}
                                    onChange={e => setMemberId(e.target.value)}
                                    required
                                >
                                    <option value="">Select a user</option>
                                    {users
                                        .filter(user => !members.some(
                                            member => member.user_id === user._id
                                        ))
                                        .map(user => (
                                            <option key={user._id} value={user._id}>
                                                {user.name} ({user.username})
                                            </option>
                                        ))}
                                </select>
                            </label>

                            <button type="submit">Add Member</button>
                        </form>
                    </>
                )}
            </section>
        </main>
    );
}

export default App;
