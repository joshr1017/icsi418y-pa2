import Signup from "./components/Signup";
import Login from "./components/Login";
import "./App.css";

function App() {
    return (
        <div className="app">
            <h1>ICSI 418Y Login System</h1>

            <div className="forms">
                <Signup />
                <Login />
            </div>
        </div>
    );
}

export default App;