// src/App.tsx

import CreateEventForm from './components/CreateEventForm';
import "./css/App.css";
import "./css/CreateEventForm.css";

function App() {

  return (
    <>
      <header className="app-header">
          {/* <img
            src="/scheduling-is-hard-logo.svg"
            alt="Scheduling Is Hard Logo"
            style={{ height: "2rem", width: "auto" }}
          /> */}
          <h1 className="app-title">Scheduling Is Hard</h1>
          <p className="app-subtitle">
            Mutually find availability with any number of people
          </p>
      </header>

      <main className="app-main">
        <CreateEventForm />
      </main>
    </>
  );
}

export default App;
