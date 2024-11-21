import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "../styles/login.css";
import { Spinner, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

const LoginPage = () => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await axios.post(
        "http://localhost:5167/api/auth/login",
        { userName, password }
      );
      const { token, userId } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("userId", userId);

      navigate("/chat");
    } catch (error) {
      if (error.code === "ERR_NETWORK") {
        setErrorMessage("Server Error detected...");
      } else {
        setErrorMessage(error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div
        className="login-form"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Login</h2>

        <Form onSubmit={handleLogin}>
          <Form.Group className="mb-3">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              placeholder="name@example.com"
              id="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>

          <button type="submit" disabled={loading} className="login-button">
            {loading ? (
              <Spinner animation="border" variant="light" size="sm" />
            ) : (
              "Login"
            )}
          </button>
          {errorMessage && <div className="error-message">{errorMessage}</div>}
        </Form>

        <p className="register-prompt">
          Don't have an account?{" "}
          <a href="/register" className="register-link">
            Register
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
