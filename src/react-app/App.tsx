// src/App.tsx

import CreateEventForm from "./components/CreateEventForm";
import "./css/App.css";
import "./css/CreateEventForm.css";

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">📆 Scheduling Is Hard 😓</h1>
        <p className="app-subtitle">
          Mutually find availability with people
        </p>
      </header>

      <main className="app-main">
        <CreateEventForm />
      </main>
    </div>
  );
}

export default App;
