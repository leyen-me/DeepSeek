import { useState } from "react";
import Markdown from "react-markdown";

const controller = new AbortController();
const signal = controller.signal;

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const getStream = (newMessages) => {
    let _newMessages = newMessages.map((message) => {
      return {
        role: message.role,
        content:
          message.role === "assistant"
            ? message.content + message.lastAnswer
            : message.content,
      };
    });
    fetch("https://ds.leyen.me/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(_newMessages),
      signal,
    })
      .then((response) => {
        let reader = response.body.getReader();
        let accumulatedContent = "";
        let lastAccumulatedContent = "";
        let lastAnswer = false;

        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setIsSending(false);
              return;
            }
            const text = new TextDecoder().decode(value);
            // 如果碰到=== Final Answer ===，则是最后回答
            console.log('====>',text);
            
            if (text.includes("=== Final Answer ===")) {
              lastAnswer = true;
              readStream();
              return;
            }
            if (lastAnswer) {
              lastAccumulatedContent += text;
              setMessages((prev) => {
                const prevMessages = [...prev];
                prevMessages[prevMessages.length - 1] = {
                  role: "assistant",
                  content: accumulatedContent,
                  lastAnswer: lastAccumulatedContent,
                };
                return prevMessages;
              });
            } else {
              accumulatedContent += text;
              setMessages((prev) => {
                const prevMessages = [...prev];
                prevMessages[prevMessages.length - 1] = {
                  role: "assistant",
                  content: accumulatedContent,
                  lastAnswer: "",
                };
                return prevMessages;
              });
            }
            readStream();
          });
        }

        readStream();
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          console.log("Fetch aborted");
        } else {
          console.error("Fetch error:", err);
        }
        setIsSending(false);
      });

    return () => {
      if (controller) {
        controller.abort();
      }
    };
  };

  const handleSendMessage = () => {
    if (isSending) {
      if (controller) {
        controller.abort();
      }
      setIsSending(false);
      return;
    }
    let newMessages = [
      ...messages,
      // { role: Math.random() > 0.5 ? "user" : "assistant", content: message },
      { role: "user", content: message },
      { role: "assistant", content: "", lastAnswer: "" }
    ];
    setMessages(newMessages);
    setMessage("");
    setIsSending(true);

    try {
      const cleanup = getStream(newMessages);
      return () => {
        if (cleanup) cleanup();
      };
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      setIsSending(false);
    }
  };

  return (
    <div
      className="app-container"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <header
        style={{
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button style={{ border: "none", background: "none" }}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.15625 9.92725C4.15625 9.444 4.59356 9.05225 5.13302 9.05225H22.867C23.4064 9.05225 23.8438 9.444 23.8438 9.92725C23.8438 10.4105 23.4064 10.8022 22.867 10.8022H5.13302C4.59356 10.8022 4.15625 10.4105 4.15625 9.92725Z"
              fill="#262626"
              fill-rule="evenodd"
            />
            <path
              d="M4.15625 18.0725C4.15625 17.5893 4.60928 17.1975 5.16811 17.1975H16.9256C17.4845 17.1975 17.9375 17.5893 17.9375 18.0725C17.9375 18.5558 17.4845 18.9475 16.9256 18.9475H5.16811C4.60928 18.9475 4.15625 18.5558 4.15625 18.0725Z"
              fill="#262626"
              fill-rule="evenodd"
            />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: "15px" }}>新对话</h1>
        <button style={{ border: "none", background: "none" }}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 5.70459C9.40419 5.70459 5.68222 9.42054 5.68222 13.9999C5.68222 15.8636 6.29743 17.5816 7.33699 18.9663C7.52584 19.2178 7.56514 19.5514 7.43993 19.8399L6.4611 22.0957L6.37453 22.2952H6.56445H14C18.5958 22.2952 22.3178 18.5792 22.3178 13.9999C22.3178 9.42054 18.5958 5.70459 14 5.70459ZM3.93222 13.9999C3.93222 8.45 8.44174 3.95459 14 3.95459C19.5583 3.95459 24.0678 8.45 24.0678 13.9999C24.0678 19.5498 19.5583 24.0452 14 24.0452H5.04103C4.7462 24.0452 4.4712 23.8967 4.30946 23.6502C4.14771 23.4037 4.12098 23.0923 4.23834 22.8219L5.63809 19.5961C4.56105 17.9968 3.93222 16.0706 3.93222 13.9999Z"
              fill="#000000"
              fill-rule="evenodd"
            />
            <path
              d="M14 18.1562C13.5168 18.1562 13.125 17.7645 13.125 17.2812V10.7188C13.125 10.2355 13.5168 9.84375 14 9.84375C14.4832 9.84375 14.875 10.2355 14.875 10.7188V17.2812C14.875 17.7645 14.4832 18.1562 14 18.1562Z"
              fill="#000000"
              fill-rule="evenodd"
            />
            <path
              d="M9.84375 14C9.84375 13.5168 10.2355 13.125 10.7188 13.125H17.2813C17.7645 13.125 18.1563 13.5168 18.1563 14C18.1563 14.4832 17.7645 14.875 17.2813 14.875H10.7188C10.2355 14.875 9.84375 14.4832 9.84375 14Z"
              fill="#000000"
              fill-rule="evenodd"
            />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      {messages.length > 0 ? (
        <main
          style={{ flex: 1, height: 0, padding: "30px 15px", overflow: "auto" }}
        >
          {messages.map((message, index) => {
            return message.role === "system" ? (
              <></>
            ) : (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    message.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: "20px",
                }}
              >
                {message.role === "assistant" ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "999px",
                          border: "1.5px solid #D5D5D5",
                        }}
                      >
                        <img
                          style={{ width: "22px", height: "22px" }}
                          src={"./assets/logo.svg"}
                          alt="assistant"
                        />
                      </div>
                      <div style={{ marginLeft: "12px", color: "#767676" }}>
                        思考中...
                      </div>
                      <svg
                        style={{ marginLeft: "12px" }}
                        viewBox="0 0 1024 1024"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        width="22px"
                        height="22px"
                      >
                        <path
                          d="M512 330.666667c14.933333 0 29.866667 4.266667 40.533333 14.933333l277.33333399 234.666667c27.733333 23.466667 29.866667 64 8.53333301 89.6-23.466667 27.733333-64 29.866667-89.6 8.53333299L512 477.866667l-236.8 200.53333299c-27.733333 23.466667-68.266667 19.19999999-89.6-8.53333299-23.466667-27.733333-19.19999999-68.266667 8.53333301-89.6l277.33333399-234.666667c10.666667-10.666667 25.6-14.933333 40.533333-14.933333z"
                          fill="#767676"
                        ></path>
                      </svg>
                    </div>
                    <div
                      style={{
                        maxWidth: "100%",
                        padding: "4px 16px",
                        marginLeft: "48px",
                        lineHeight: "28px",
                        fontSize: "16px",
                        letterSpacing: "2px",
                        color: "#767676",
                        borderLeft: "1.5px solid #E4E4E4",
                        backgroundColor:
                          message.role === "user" ? "#EBF3FE" : "transparent",
                      }}
                    >
                      <p>{message.content}</p>
                    </div>
                    <div
                      style={{
                        maxWidth: "100%",
                        padding: "4px 16px",
                        marginLeft: "32px",
                        lineHeight: "28px",
                        fontSize: "16px",
                        letterSpacing: "2px",
                        color: "#000",
                      }}
                    >
                      {/* https://github.com/remarkjs/react-markdown */}
                      <Markdown>{message.lastAnswer}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      lineHeight: "28px",
                      fontSize: "16px",
                      letterSpacing: "2px",
                      backgroundColor:
                        message.role === "user" ? "#EBF3FE" : "transparent",
                    }}
                  >
                    <p>{message.content}</p>
                  </div>
                )}
              </div>
            );
          })}
        </main>
      ) : (
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            style={{ width: "60px", height: "auto" }}
            src={"./assets/logo.svg"}
            alt="DeepSeek"
          />
          <h2
            style={{
              fontSize: "20px",
              lineHeight: "20px",
              marginTop: "24px",
            }}
          >
            嗨！我是 DeepSeek
          </h2>
          <p
            style={{
              marginTop: "15px",
              color: "#666",
              textAlign: "center",
              lineHeight: "24px",
            }}
          >
            我可以帮你搜索、答疑、写作，请把你
            <br />
            的任务交给我吧~
          </p>
        </main>
      )}

      {/* Footer */}
      <footer style={{ padding: "16px" }}>
        <textarea
          placeholder="给 DeepSeek 发送消息"
          rows={1}
          value={message}
          onInput={(e) => {
            setMessage(e.target.value);
            e.target.style.height = "auto";
            const newHeight = Math.min(e.target.scrollHeight, 46 * 2.5); // 最多4行
            e.target.style.height = `${newHeight}px`;
          }}
          style={{
            width: "100%",
            minHeight: "46px",
            maxHeight: "calc(46px * 2.5)", // 46px * 4行
            borderRadius: "24px",
            backgroundColor: "#f5f5f5",
            outline: "none",
            border: "none",
            fontSize: "15px",
            lineHeight: "15px",
            padding: "16px",
            resize: "none",
            overflow: "hidden",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "4px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              style={{
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#E4F0FC",
                color: "#407BE3",
                fontSize: "13px",
                borderRadius: "999px",
                padding: "0 12px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_1_1)">
                  <path
                    d="M12.76 11C12.76 11.972 11.972 12.76 11 12.76C10.028 12.76 9.24 11.972 9.24 11C9.24 10.028 10.028 9.24 11 9.24C11.972 9.24 12.76 10.028 12.76 11Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.581 17.96C9.47 17.306 11.716 15.885 13.8 13.8C15.884 11.716 17.305 9.47 17.96 7.581C18.653 5.581 18.345 4.5 17.923 4.078C17.5 3.655 16.419 3.348 14.419 4.04C12.53 4.695 10.284 6.116 8.2 8.2C6.116 10.284 4.695 12.53 4.04 14.419C3.347 16.419 3.655 17.5 4.077 17.923C4.5 18.345 5.581 18.653 7.581 17.96ZM2.988 19.012C5.136 21.16 10.465 19.314 14.889 14.889C19.314 10.465 21.159 5.137 19.011 2.989C16.864 0.841 11.536 2.686 7.111 7.111C2.686 11.536 0.841 16.864 2.988 19.012Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.04 7.581C4.695 9.47 6.116 11.716 8.2 13.8C10.284 15.885 12.53 17.306 14.419 17.96C16.419 18.653 17.5 18.345 17.923 17.923C18.345 17.5 18.653 16.419 17.96 14.419C17.306 12.53 15.884 10.284 13.8 8.2C11.716 6.116 9.47 4.695 7.581 4.04C5.581 3.347 4.5 3.655 4.077 4.078C3.655 4.5 3.347 5.581 4.04 7.581ZM2.989 2.989C0.841 5.136 2.686 10.465 7.111 14.889C11.536 19.314 16.864 21.16 19.011 19.012C21.159 16.864 19.314 11.536 14.889 7.111C10.465 2.686 5.136 0.841 2.989 2.989Z"
                    fill="currentColor"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_1_1">
                    <rect width="22" height="22" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span style={{ marginLeft: "4px" }}>深度思考（R1）</span>
            </div>

            <div
              style={{
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F5F5F5",
                color: "#505050",
                fontSize: "13px",
                borderRadius: "999px",
                padding: "0 12px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M19.178 11.77H2.31V10.23H19.178V11.77Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  d="M11.31 2.944C9.691 4.689 8.58 7.616 8.58 11C8.58 14.384 9.691 17.311 11.31 19.056L10.18 20.104C8.244 18.015 7.04 14.685 7.04 11C7.04 7.315 8.244 3.985 10.18 1.896L11.31 2.944Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  d="M10.8 2.944C12.419 4.689 13.53 7.616 13.53 11C13.53 14.384 12.419 17.311 10.8 19.056L11.93 20.104C13.866 18.015 15.07 14.685 15.07 11C15.07 7.315 13.866 3.985 11.93 1.896L10.8 2.944Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  d="M11.055 18.92C15.399 18.92 18.92 15.399 18.92 11.055C18.92 6.711 15.399 3.19 11.055 3.19C6.711 3.19 3.19 6.711 3.19 11.055C3.19 15.399 6.711 18.92 11.055 18.92ZM11.055 20.35C16.188 20.35 20.35 16.188 20.35 11.055C20.35 5.921 16.188 1.76 11.055 1.76C5.922 1.76 1.76 5.921 1.76 11.055C1.76 16.188 5.922 20.35 11.055 20.35Z"
                  fill="currentColor"
                />
              </svg>
              <span style={{ marginLeft: "4px" }}>联网搜索</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 80 80"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0,40C0,37.791 1.628,36 3.636,36H76.364C78.372,36 80,37.791 80,40C80,42.209 78.372,44 76.364,44H3.636C1.628,44 0,42.209 0,40Z"
                fill="#000000"
                fill-rule="evenodd"
              />
              <path
                d="M40,80C37.791,80 36,78.372 36,76.364L36,3.636C36,1.628 37.791,0 40,0C42.209,0 44,1.628 44,3.636L44,76.364C44,78.372 42.209,80 40,80Z"
                fill="#000000"
                fill-rule="evenodd"
              />
            </svg>

            <div
              style={{
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "999px",
                backgroundColor: "#3E81F6",
                color: "#fff",
                opacity: message.length || isSending ? 1 : 0.4,
              }}
              onClick={() => {
                handleSendMessage();
              }}
            >
              {isSending ? (
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: "#fff",
                  }}
                ></div>
              ) : (
                <svg
                  style={{ transform: "rotate(180deg)" }}
                  width="14"
                  height="16"
                  viewBox="0 0 14 16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7,1.25L7,14.75"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    fill="none"
                  />
                  <path
                    d="M12.5,9.25L7,14.75"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    fill="none"
                  />
                  <path
                    d="M1.5,9.25L7,14.75"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    fill="none"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
