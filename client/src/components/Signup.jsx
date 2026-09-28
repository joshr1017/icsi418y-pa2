import { useState } from "react";

function Signup() {
    const [form, setForm] = useState({
        f_name: "",
        l_name: "",
        username: "",
        password: ""
    });

    const [message, setMessage] = useState("");

    function handleChange(event) {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");

        try {
            const response = await fetch("http://localhost:9000/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(form)
            });

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                setForm({
                    f_name: "",
                    l_name: "",
                    username: "",
                    password: ""
                });
            }
        } catch (error) {
            setMessage("Could not connect to server");
        }
    }

    return (
        <div className="form-container">
            <h2>Sign Up</h2>

            <form onSubmit={handleSubmit}>
                <input
                    name="f_name"
                    placeholder="First Name"
                    value={form.f_name}
                    onChange={handleChange}
                />

                <input
                    name="l_name"
                    placeholder="Last Name"
                    value={form.l_name}
                    onChange={handleChange}
                />

                <input
                    name="username"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange}
                />

                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                />

                <button type="submit">Create Account</button>
            </form>

            {message && <p>{message}</p>}
        </div>
    );
}

export default Signup;