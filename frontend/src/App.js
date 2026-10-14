import React, { useState, useEffect } from "react";
import axios from "axios";
import "./index.css";

const API_URL = "http://localhost:8000/systems";

function App() {
  const [systems, setSystems] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [form, setForm] = useState({
    system_name: "",
    system_description: "",
    business_steward_email: "",
    business_steward_full_name: "",
    security_steward_email: "",
    security_steward_full_name: "",
    technical_steward_email: "",
    technical_steward_full_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const CHAT_API_URL = "http://localhost:8080/ask";

  useEffect(() => {
    fetchSystems();
  }, []);

  useEffect(() => {
    // Remove auto-select of first system
    // if (systems.length > 0 && !selectedSystem) {
    //   setSelectedSystem(systems[0]);
    // }
  }, [systems, selectedSystem]);

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL + "/");
      setSystems(res.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch systems.");
    }
    setLoading(false);
  };

  const fetchSystemById = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/${id}`);
      setSelectedSystem(res.data);
      setError("");
    } catch (err) {
      setError("System not found.");
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleShowForm = () => setShowForm(true);
  const handleCancelForm = () => {
    setShowForm(false);
    setForm({
      system_name: "",
      system_description: "",
      business_steward_email: "",
      business_steward_full_name: "",
      security_steward_email: "",
      security_steward_full_name: "",
      technical_steward_email: "",
      technical_steward_full_name: "",
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(API_URL + "/", form);
      setSystems([...systems, res.data]);
      setForm({
        system_name: "",
        system_description: "",
        business_steward_email: "",
        business_steward_full_name: "",
        security_steward_email: "",
        security_steward_full_name: "",
        technical_steward_email: "",
        technical_steward_full_name: "",
      });
      setError("");
      setShowForm(false);
    } catch (err) {
      setError("Failed to create system.");
    }
    setLoading(false);
  };

  const handleChatSend = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatLoading(true);
    const userMessage = { sender: "user", text: chatInput };
    setChatHistory((prev) => [...prev, userMessage]);
    try {
      const res = await axios.post(CHAT_API_URL, { question: chatInput });
      setChatHistory((prev) => [...prev, { sender: "bot", text: res.data.answer }]);
      setChatInput("");
    } catch (err) {
      setChatHistory((prev) => [...prev, { sender: "bot", text: "Sorry, there was an error." }]);
    }
    setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col md:flex-row relative w-full max-w-[1800px] mx-auto">
      {/* Main Content for All Systems */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-6 text-blue-700 font-serif tracking-tight">Systems Catalog</h1>
          <div className="mb-4 flex justify-end">
            <button
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:from-blue-700 hover:to-purple-700 transition"
              onClick={handleShowForm}
            >
              Add New System
            </button>
          </div>
          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-2 text-purple-700 font-sans">All Systems</h2>
              <ul className="divide-y divide-gray-200 bg-white rounded-lg shadow mb-6">
                {systems.map((sys) => (
                  <li
                    key={sys.system_id}
                    className={`py-4 px-4 flex justify-between items-center transition cursor-pointer ${selectedSystem && selectedSystem.system_id === sys.system_id ? 'bg-blue-100' : 'hover:bg-purple-50'}`}
                  >
                    <span className={`font-semibold text-gray-800 ${selectedSystem && selectedSystem.system_id === sys.system_id ? 'text-blue-700' : ''}`}>{sys.system_name}</span>
                    <button
                      className={`text-blue-600 hover:underline font-medium ${selectedSystem && selectedSystem.system_id === sys.system_id ? 'font-bold' : ''}`}
                      onClick={() => fetchSystemById(sys.system_id)}
                    >
                      View Details
                    </button>
                  </li>
                ))}
              </ul>
              {selectedSystem && (
                <div className="mt-6 p-6 border rounded bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg">
                  <h3 className="text-lg font-bold mb-4 text-blue-700 font-serif">System Details</h3>
                  <div className="mb-2"><span className="font-bold text-purple-700">ID:</span> <span className="font-mono text-gray-700">{selectedSystem.system_id}</span></div>
                  <div className="mb-2"><span className="font-bold text-purple-700">Name:</span> <span className="font-semibold text-blue-800">{selectedSystem.system_name}</span></div>
                  <div className="mb-2"><span className="font-bold text-purple-700">Description:</span> <span className="font-normal text-gray-800">{selectedSystem.system_description}</span></div>
                  <div className="mb-2"><span className="font-bold text-purple-700">Business Steward:</span> <span className="font-semibold text-blue-800">{selectedSystem.business_steward_full_name}</span> <span className="text-gray-600">({selectedSystem.business_steward_email})</span></div>
                  <div className="mb-2"><span className="font-bold text-purple-700">Security Steward:</span> <span className="font-semibold text-blue-800">{selectedSystem.security_steward_full_name}</span> <span className="text-gray-600">({selectedSystem.security_steward_email})</span></div>
                  <div className="mb-2"><span className="font-bold text-purple-700">Technical Steward:</span> <span className="font-semibold text-blue-800">{selectedSystem.technical_steward_full_name}</span> <span className="text-gray-600">({selectedSystem.technical_steward_email})</span></div>
                  <button className="mt-4 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold transition" onClick={() => setSelectedSystem(null)}>Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      {/* Sidebar for Add System Form - now on the right, only visible when showForm is true */}
      {showForm && (
        <aside className="w-full md:w-1/3 bg-white shadow-lg p-8 flex flex-col justify-between border-l border-gray-200 fixed top-0 right-0 h-full z-50 overflow-y-auto">
          <div>
            <h2 className="text-2xl font-extrabold text-purple-700 mb-6 font-sans text-center">Add System</h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
              <div className="flex flex-col col-span-2">
                <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="system_name">System Name</label>
                <input name="system_name" id="system_name" value={form.system_name} onChange={handleInputChange} placeholder="System Name" className="border-2 border-purple-300 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition" required />
              </div>
              <div className="flex flex-col col-span-2">
                <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="system_description">Description</label>
                <input name="system_description" id="system_description" value={form.system_description} onChange={handleInputChange} placeholder="Description" className="border-2 border-purple-300 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition" required />
              </div>
              {/* Business Steward Group */}
              <div className="col-span-2 mt-2 mb-2">
                <h3 className="text-md font-bold text-blue-700 mb-2">Business Steward</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="business_steward_email">Email</label>
                    <input name="business_steward_email" id="business_steward_email" value={form.business_steward_email} onChange={handleInputChange} placeholder="Business Steward Email" className="border-2 border-blue-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition" required />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="business_steward_full_name">Name</label>
                    <input name="business_steward_full_name" id="business_steward_full_name" value={form.business_steward_full_name} onChange={handleInputChange} placeholder="Business Steward Name" className="border-2 border-blue-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition" required />
                  </div>
                </div>
              </div>
              {/* Security Steward Group */}
              <div className="col-span-2 mt-2 mb-2">
                <h3 className="text-md font-bold text-purple-700 mb-2">Security Steward</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="security_steward_email">Email</label>
                    <input name="security_steward_email" id="security_steward_email" value={form.security_steward_email} onChange={handleInputChange} placeholder="Security Steward Email" className="border-2 border-purple-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 transition" required />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="security_steward_full_name">Name</label>
                    <input name="security_steward_full_name" id="security_steward_full_name" value={form.security_steward_full_name} onChange={handleInputChange} placeholder="Security Steward Name" className="border-2 border-purple-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 transition" required />
                  </div>
                </div>
              </div>
              {/* Technical Steward Group */}
              <div className="col-span-2 mt-2 mb-2">
                <h3 className="text-md font-bold text-green-700 mb-2">Technical Steward</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="technical_steward_email">Email</label>
                    <input name="technical_steward_email" id="technical_steward_email" value={form.technical_steward_email} onChange={handleInputChange} placeholder="Technical Steward Email" className="border-2 border-green-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-green-400 transition" required />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="technical_steward_full_name">Name</label>
                    <input name="technical_steward_full_name" id="technical_steward_full_name" value={form.technical_steward_full_name} onChange={handleInputChange} placeholder="Technical Steward Name" className="border-2 border-green-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-green-400 transition" required />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-4 col-span-2">
                <button type="submit" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-6 rounded-lg font-bold shadow hover:from-blue-700 hover:to-purple-700 transition">Save</button>
                <button type="button" className="bg-gray-300 text-gray-700 py-2 px-6 rounded-lg font-bold shadow hover:bg-gray-400 transition" onClick={handleCancelForm}>Cancel</button>
              </div>
            </form>
            {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
          </div>
          <div className="mt-8 text-xs text-gray-400 text-center">Powered by FastAPI & React</div>
        </aside>
      )}
      {/* Collapsible Chat Panel at Upper Right */}
      <div className="fixed top-6 right-6 z-50">
        {chatOpen ? (
          <div className="w-[500px] h-[500px] bg-white rounded-lg shadow-lg p-4 border border-purple-300 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-purple-700 font-sans">Chat with AI</h2>
              <button className="text-gray-400 hover:text-purple-700 text-xl font-bold" onClick={() => setChatOpen(false)}>&#10005;</button>
            </div>
            <div className="flex-1 overflow-y-auto mb-2 bg-gray-50 rounded p-2 border border-gray-200">
              {chatHistory.length === 0 && (
                <div className="text-gray-400 text-center">Start a conversation...</div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`mb-2 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`inline-block px-3 py-2 rounded-lg max-w-xs ${msg.sender === "user" ? "bg-blue-600 text-white" : "bg-purple-100 text-gray-800"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleChatSend}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border-2 border-purple-300 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-y min-h-[48px] max-h-[120px] overflow-y-auto"
                disabled={chatLoading}
                rows={2}
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:from-blue-700 hover:to-purple-700 transition"
                disabled={chatLoading}
              >
                {chatLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        ) : (
          <button
            className="bg-gradient-to-r from-pink-400 to-orange-400 text-white px-4 py-2 rounded-full font-bold shadow hover:from-pink-500 hover:to-orange-500 transition flex items-center gap-2 border-2 border-orange-500"
            onClick={() => setChatOpen(true)}
            aria-label="Open chat"
          >
            Need Assistance?
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
