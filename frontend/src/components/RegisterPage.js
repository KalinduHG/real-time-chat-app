import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "../styles/register.css";
import { Spinner, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

const RegisterPage = () => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      await axios.post("http://localhost:5167/api/auth/register", {
        userName,
        password,
      });
      navigate("/");
    } catch (error) {
      if (error.response.status === 400) {
        setErrorMessage(error.response.data);
      } else {
        setErrorMessage("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <motion.div
        className="register-form"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Register</h2>

        <Form onSubmit={handleRegister}>
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

          <button type="submit" disabled={loading} className="register-button">
            {loading ? (
              <Spinner animation="border" variant="light" size="sm" />
            ) : (
              "Register"
            )}
          </button>
          {errorMessage && <div className="error-message">{errorMessage}</div>}
        </Form>

        <p className="login-prompt">
          Already have an account?{" "}
          <a href="/" className="login-link">
            Log in
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
