import React, { useState, useEffect, useRef } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import { Slide, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useUserDetails from "./../hooks/useUserDetails";
import "../styles/chatpage.css";
import { FaSignOutAlt } from "react-icons/fa";
import { BsFillSendFill } from "react-icons/bs";
import {
  Modal,
  Button,
  ListGroup,
  Container,
  Row,
  Col,
  Badge,
  Stack,
  Form,
  Spinner,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
const ChatApp = () => {
  const [connection, setConnection] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatSessionActive, setChatSessionActive] = useState(false);
  const [chatPartnerId, setChatPartnerId] = useState("");
  const [chatPartnerName, setChatPartnerName] = useState("");
  const [incomingRequestId, setIncomingRequestId] = useState(null);
  const [incomingRequestName, setIncomingRequestName] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [loading, setLoading] = useState(false);
  //const [messageLoading, setMessageLoading] = useState(false);
  const { userDetails, isLoading, error } = useUserDetails();
  const [isModalVisible, setModalVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmEndChatModal, setShowConfirmEndChatModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalContent, setModalContent] = useState({});

  const [newRequesterId, setNewRequesterId] = useState(null);
  const navigate = useNavigate();

  const usernamesRef = useRef({});
  const messagesEndRef = useRef(null);

  // Establish SignalR connection
  useEffect(() => {
    if (!userDetails) return;

    const connectSignalR = async () => {
      const conn = new HubConnectionBuilder()
        .withUrl("http://localhost:5167/chathub", {
          accessTokenFactory: () => localStorage.getItem("token"),
        })
        .build();

      conn.on("OnlineUsersUpdated", (users) => {
        setOnlineUsers(users);
        const userMap = {};
        users.forEach((user) => {
          userMap[user.userId] = user.username;
        });

        setUsernames(userMap);
        usernamesRef.current = userMap;
      });

      conn.on("ReceiveChatRequest", (requesterId) => {
        //const requesterUsername = usernames[requesterId] || `User ${requesterId}`;
        const requesterUsername =
          usernamesRef.current[requesterId] || `User ${requesterId}`;
        setIncomingRequestId(requesterId);
        setIncomingRequestName(requesterUsername);
        setModalVisible(true);
      });

      conn.on("ChatSessionStarted", (partnerId, partnerName) => {
        // console.log(partnerId);
        setChatSessionActive(true);
        setChatPartnerId(partnerId);
        setChatPartnerName(partnerName);

        conn.invoke("FetchChatHistory", partnerId).catch((err) => {
          toast.error("Failed to load chat history.");
        });

        toast.success("Chat session started!");
      });

      conn.on("ReceiveMessage", (senderUsername, message, senderId) => {
        setMessages((prevMessages) => [
          ...prevMessages,

          { sender: senderUsername, message, senderId },
        ]);
      });

      conn.on("ChatRequestDeclined", (receiverId) => {
        const receiverUsername = usernamesRef.current[receiverId] || receiverId;
        toast.error(`${receiverUsername} declined your chat request.`);
      });

      conn.on("ChatRequestFailed", (errorMessage) => {
        toast.error(errorMessage || "Failed to send chat request.");
      });

      conn.on("ConfirmEndCurrentChat", (existingUserName, newRequesterId) => {
        setShowConfirmEndChatModal(true);
        setModalMessage(
          `You are already in a chat with ${existingUserName}. Do you want to end the current chat and start a new one?`
        );

        setNewRequesterId(newRequesterId);
      });

      conn.on("ChatSessionEnded", (partnerUsername) => {
        toast.info(`The chat session with ${partnerUsername} has ended.`);

        setChatSessionActive(false);
        setChatPartnerId("");
        setChatPartnerName("");
        setMessages([]);
      });

      conn.on("ChatHistoryLoaded", (messages) => {
        setMessages(messages);
      });

      conn.on("ChatRequestResponse", (messages) => {
        toast.success(messages);
      });

      try {
        await conn.start();
        setConnection(conn);
        console.log("Connected to SignalR hub!");
      } catch (err) {
        toast.error(
          "Failed to connect to the chat server. Retrying in 5 seconds..."
        );
        console.error("Error connecting to SignalR:", err);
        setTimeout(connectSignalR, 5000); // Retry connection after 5 seconds
      }
    };

    connectSignalR();

    return () => {
      if (connection) {
        connection.stop();
        console.log("Disconnected from SignalR hub");
      }
    };
  }, [userDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChatRequest = (userDet) => {
    if (connection && userDet) {
      setLoading(true);
      connection
        .invoke("SendChatRequest", userDet.userId)
        .then(() => {
          // toast.success("Chat request sent!");
        })
        .catch((err) => {
          toast.error("Error sending chat request:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const respondToChatRequest = (isAccepted) => {
    if (incomingRequestId && connection) {
      connection
        .invoke("RespondToChatRequest", incomingRequestId, isAccepted)
        .then(() => {
          // if (isAccepted) {
          //   toast.success("Chat request accepted!");
          // }
          // else {
          //   toast.info("Chat request declined.");
          // }
        })
        .catch((err) => {
          toast.error("Error responding to chat request.");
        })
        .finally(() => {
          setIncomingRequestId(null);
          setIncomingRequestName(null);
        });
    }
  };

  const sendMessage = async (message) => {
    if (message.trim() !== "" && connection && chatSessionActive) {
      try {
        await connection.invoke(
          "SendMessage",
          message,
          userDetails.id,
          chatPartnerId
        );
      } catch (err) {
        toast.error("Failed to send message. Please try again.");
      }
    }
  };

  const endChatSession = () => {
    if (connection && chatSessionActive) {
      connection
        .invoke("EndChatSession", chatPartnerId)
        .then(() => {
          setChatSessionActive(false);
          setChatPartnerId("");
          setChatPartnerName("");
          setMessages([]);
        })
        .catch((err) => toast.error("Error ending chat session"));
    }
  };

  const handleShowModal = (header, actionType, message, callback) => {
    setModalContent({ header, actionType, message, callback });
    setShowModal(true);
  };

  const handleConfirm = () => {
    setShowModal(false);
    if (modalContent.callback) modalContent.callback();
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  const handleConfirmConfirmEnd = () => {
    if (connection) {
      connection
        .invoke("EndCurrentChatAndStartNew", newRequesterId)
        .then(() => {
          setShowConfirmEndChatModal(false);
        })
        .catch((err) => {
          toast.error("Failed to end chat session.");
          //console.error(err);
        });
    } else {
      // console.error("Connection is null or undefined.");
      toast.error("Connection to chat server is unavailable.");
    }
  };
  const handleCancelConfirmEnd = () => {
    setShowConfirmEndChatModal(false);
  };

  const handleSendMessage = (e) => {
    e.preventDefault(); // Prevents the default form submission
    if (message.trim()) {
      sendMessage(message); // Call the sendMessage function with the message
      setMessage(""); // Clear the input field after sending
    }
  };

  function RequestModal(props) {
    return (
      <Modal
        {...props}
        size="md"
        aria-labelledby="contained-modal-title-vcenter"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">
            Chat Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{incomingRequestName}</strong> wants to chat! Do you accept?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => {
              respondToChatRequest(true);
              setModalVisible(false);
            }}
            style={{
              padding: "10px 15px",
              marginRight: "10px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Accept
          </Button>
          <Button
            onClick={() => {
              respondToChatRequest(false);
              setModalVisible(false);
            }}
            style={{
              padding: "10px 15px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Decline
          </Button>
          {/* <Button onClick={props.onHide}>Close</Button> */}
        </Modal.Footer>
      </Modal>
    );
  }

  const ConfirmModal = ({ show, title, message, onConfirm, onCancel }) => {
    return (
      <Modal show={show} onHide={onCancel}>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{message}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    if (connection) {
      connection.stop();
    }
    // window.location.reload(); // Reload the page to simulate logout
    navigate("/");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  // if (isLoading) {
  //   return <div>Loading user details...</div>;
  // }

  // if (error) {
  //   return <div>Error: {error}</div>;
  // }
  // if (incomingRequest && !isModalVisible) {
  //   setModalVisible(true);
  // }

  return (
    <Container fluid>
      <ToastContainer transition={Slide} />

      {/* Header Section */}
      <Row className="header">
        <Col md={{ span: 2, offset: 10 }} Col>
          {userDetails ? (
            <span className="username">{userDetails.username}</span>
          ) : null}
          <button
            className="logout-btn"
            onClick={() =>
              handleShowModal(
                "Logout",
                "logout",
                "Are you sure you want to logout?",
                handleLogout
              )
            }
          >
            <FaSignOutAlt />
          </button>
        </Col>
      </Row>

      <Row className="chat-layout">
        <Col sm={9}>
          <div className="active-chat">
            {chatSessionActive ? (
              <>
                <Row>
                  <Col>
                    <h3>{chatPartnerName}</h3>
                  </Col>
                  <Col style={{ textAlign: "right" }}>
                    <Button
                      variant="outline-danger"
                      onClick={() =>
                        handleShowModal(
                          "End Chat Session",
                          "endChat",
                          "Are you sure you want to end this chat session?",
                          endChatSession
                        )
                      }
                    >
                      End Chat
                    </Button>
                  </Col>
                </Row>

                <div className="messages">
                  {messages && messages.length > 0 ? (
                    <>
                      {messages.map((msg, index) => {
                        console.log(msg);
                        const isSender = msg.senderId === userDetails.id;
                        const sentTime = new Date(msg.sentAt).toLocaleDateString('en-US', {
                          month: 'short', // Short month name (e.g., "Nov")
                          day: 'numeric', // Day of the month (e.g., "23")
                        }) + ' ' + new Date(msg.sentAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <div
                            key={index}
                            className={`message-container ${
                              isSender ? "sender" : "receiver"
                            }`}
                          >
                            <p
                              className={`message ${
                                isSender ? "sender" : "receiver"
                              }`}
                            >
                              {msg.message}
                            </p>
                            <p className="message-time">{sentTime}</p>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  ) : (
                    <p className="no-messages">
                      No messages yet. Start a conversation!
                    </p>
                  )}
                </div>

                <Stack direction="horizontal" gap={3}>
                  <Form.Control
                    type="text"
                    className="me-auto"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ flexGrow: 1, marginRight: "10px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <Button
                    variant="primary"
                    onClick={(e) => handleSendMessage(e)}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={!message.trim()}
                  >
                    <BsFillSendFill />
                  </Button>
                  {/* <div className="vr" /> */}
                </Stack>
              </>
            ) : (
              <h3 className="no-active-chat">No active chat session</h3>
            )}
          </div>
        </Col>
        <Col sm={3}>
          <ListGroup className="online-users">
            {onlineUsers
              .filter((user) => user.userId !== userDetails.id)
              .map((user, index) => (
                <ListGroup.Item
                  action
                  onClick={() =>
                    handleShowModal(
                      "Chat Request",
                      "sendRequest",
                      `Do you want to send a chat request to ${user.username}?`,
                      () => sendChatRequest(user)
                    )
                  }
                  key={user.userId}
                  disabled={user.userId === userDetails.id}
                >
                  <Stack direction="horizontal">
                    <div className="p-2"> {user.username}</div>
                    <div className="p-2  ms-auto">
                      <Badge pill bg="success">
                        Online
                      </Badge>
                    </div>
                  </Stack>
                </ListGroup.Item>
              ))}
          </ListGroup>
        </Col>
      </Row>

      <RequestModal
        show={isModalVisible}
        onHide={() => {
          respondToChatRequest(false);
          setModalVisible(false);
        }}
      />

      <Modal show={showModal} onHide={handleCancel}>
        <Modal.Header closeButton>
          <Modal.Title>{modalContent.header}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalContent.message}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={showConfirmEndChatModal}
        title="End Current Chat"
        message={modalMessage}
        onConfirm={handleConfirmConfirmEnd}
        onCancel={handleCancelConfirmEnd}
      />
    </Container>
  );
};

export default ChatApp;
