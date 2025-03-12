import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { Input, Modal, Drawer, Divider, Button } from "antd";
import { nanoid } from "nanoid";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { isMobile } from "react-device-detect";
import { message as Message } from "antd";

const { TextArea } = Input;

const tryJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return [];
  }
};

const CodeBlock = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ position: "relative", borderRadius: "6px", margin: "8px 0" }}
      onMouseEnter={() => setShowButton(true)}
      onMouseLeave={() => setShowButton(false)}
    >
      {showButton && (
        <button
          onClick={handleCopy}
          style={{
            position: "absolute",
            right: "8px",
            top: "8px",
            padding: "4px 8px",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            fontSize: "12px",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
      )}
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        className="syntax-code"
        customStyle={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          wordWrap: "break-word",
          overflowX: "hidden",
          maxWidth: "100%",
          borderRadius: "6px",
          padding: "12px",
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
};

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState("新对话");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const isScrollingRef = useRef(false);

  // All messages
  const [allMessages, setAllMessages] = useState(
    tryJsonParse(localStorage.getItem("all_messages")) || []
  );
  const [activeMessage, setActiveMessage] = useState("");

  const [groupedMessages, setGroupedMessages] = useState({
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  });

  // Add computed function for message grouping
  const computeGroupedMessages = (messages) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // Sort messages by createdAt in descending order
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return {
      today: sortedMessages.filter((msg) => new Date(msg.createdAt) >= today),
      yesterday: sortedMessages.filter(
        (msg) =>
          new Date(msg.createdAt) >= yesterday &&
          new Date(msg.createdAt) < today
      ),
      week: sortedMessages.filter(
        (msg) =>
          new Date(msg.createdAt) >= weekAgo &&
          new Date(msg.createdAt) < yesterday
      ),
      month: sortedMessages.filter(
        (msg) =>
          new Date(msg.createdAt) >= monthAgo &&
          new Date(msg.createdAt) < weekAgo
      ),
      older: sortedMessages.filter((msg) => new Date(msg.createdAt) < monthAgo),
    };
  };

  // Add useEffect to update groupedMessages when allMessages changes
  useEffect(() => {
    let _messages = [...allMessages];
    const _activeMessage = _messages.find(
      (message) => message.id === activeMessage
    );
    if (_activeMessage) {
      _activeMessage.list = messages;
    }
    setAllMessages(_messages);
  }, [messages]);

  useEffect(() => {
    setGroupedMessages(computeGroupedMessages(allMessages));
    localStorage.setItem("all_messages", JSON.stringify(allMessages));
  }, [allMessages]);

  useEffect(() => {
    if (!activeMessage) {
      setTitle("新对话");
    }
    const _activeMessage = allMessages.find(
      (message) => message.id === activeMessage
    );
    if (_activeMessage) {
      setMessages(_activeMessage.list);
      setTitle(_activeMessage.list[0].content);
    }
  }, [activeMessage]);

  const controllerRef = useRef(null);
  const inputRef = useRef(null);
  // Add ref for main container
  const mainRef = useRef(null);

  const userScrolledRef = useRef(false);
  // Add scroll helper function
  const scrollToBottom = () => {
    if (mainRef.current && shouldAutoScroll && !userScrolledRef.current) {
      isScrollingRef.current = true;
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  };
  const handleScroll = (e) => {
    if (e.isTrusted) {
      userScrolledRef.current = true;
      const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

      if (isAtBottom) {
        userScrolledRef.current = false;
        setShouldAutoScroll(true);
      } else {
        setShouldAutoScroll(false);
      }
    }
  };

  const handleOpenDrawer = () => {
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const getMessage = (newMessages) => {
    let _newMessages1 = newMessages.map((message) => {
      // 如果system prompt是空，则不加入
      if (message.content.trim() === "") {
        return null;
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
    let _newMessages2 = _newMessages1.filter(
      (message) => message != null && message.content.trim() !== ""
    );
    return _newMessages2;
  };

  const getStream = (newMessages) => {
    // 创建新的 AbortController
    controllerRef.current = new AbortController();
    let url = "https://ds.leyen.me/v1/stream";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        messages: getMessage(newMessages),
      }),
      signal: controllerRef.current.signal,
    })
      .then((response) => {
        let reader = response.body.getReader();
        let allContent = "";

        function readStream() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                setMessages((prev) => {
                  const prevMessages = [...prev];
                  prevMessages[prevMessages.length - 1]["loading"] = false;
                  return prevMessages;
                });
                scrollToBottom();
                setIsSending(false);
                return;
              }
              const text = new TextDecoder().decode(value);
              console.log("======>", text);

              allContent += text;
              setMessages((prev) => {
                const prevMessages = [...prev];
                prevMessages[prevMessages.length - 1]["content"] = allContent;
                scrollToBottom();
                return prevMessages;
              });

              readStream();
            })
            .catch((err) => {
              if (err.name === "AbortError") {
                console.log("Stream reading aborted");
              } else {
                console.error("Stream reading error:", err);
              }
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
        setMessages((prev) => {
          const prevMessages = [...prev];
          prevMessages[prevMessages.length - 1]["loading"] = false;
          return prevMessages;
        });
        setIsSending(false);
      });

    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  };

  const handleStop = () => {
    if (isSending) {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setMessages((prev) => {
        const prevMessages = [...prev];
        prevMessages[prevMessages.length - 1]["loading"] = false;
        return prevMessages;
      });
      setIsSending(false);
    }
  };

  const handleSendMessage = () => {
    if (isSending) {
      handleStop();
      return;
    }
    if (message.trim() === "") {
      return;
    }
    userScrolledRef.current = false;
    setShouldAutoScroll(true);
    if (!activeMessage) {
      let id = nanoid();
      setActiveMessage(id);
      setAllMessages([
        { id, createdAt: new Date(), list: messages },
        ...allMessages,
      ]);
    }
    let newMessages = [
      ...messages,
      { role: "user", content: message },
      {
        role: "assistant",
        content: "",
        loading: true,
      },
    ];
    if (title === "新对话") {
      setTitle(newMessages[0].content);
    }
    setMessages(newMessages);
    setMessage("");
    handleQuestion(newMessages);
  };

  const handleQuestion = (newMessages) => {
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

  const handleCopy = async (message) => {
    try {
      await navigator.clipboard.writeText(
        message.content + "\n\n" + message.lastAnswer
      );
      Message.success("复制成功!");
    } catch (err) {
      console.error("复制失败:", err);
      Message.error("复制失败!");
    }
  };

  const handleRefresh = (message) => {
    // 删除当前位置以后的所有对话
    const index = messages.findIndex((m) => m === message);
    const newMessages = messages.slice(0, index + 1);

    // 初始化最后一条对话
    newMessages[newMessages.length - 1]["role"] = "assistant";
    newMessages[newMessages.length - 1]["content"] = "";
    newMessages[newMessages.length - 1]["loading"] = true;
    setMessages(newMessages);

    // 重新提问
    handleQuestion(newMessages);
  };

  const handleNew = () => {
    if (!isSending && !activeMessage) {
      Message.warning("你已经在新的对话中了！");
      return;
    }

    // 停止当前对话
    handleStop();

    // 清空对话
    setMessages([]);

    setActiveMessage("");
    setMessage("");
    setTitle("新对话");
  };

  const handleClear = () => {
    // 基础用法
    Modal.confirm({
      title: "确认清除",
      content: "确定要清除所有记录吗？",
      onOk() {
        // 停止当前对话
        handleStop();
        setAllMessages([]);
        setActiveMessage("");
        handleCloseDrawer();
        Message.success("清除成功！");
      },
      onCancel() {},
    });
  };

  return (
    <>
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
          <button
            style={{ border: "none", background: "none" }}
            onClick={handleOpenDrawer}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.15625 9.92725C4.15625 9.444 4.59356 9.05225 5.13302 9.05225H22.867C23.4064 9.05225 23.8438 9.444 23.8438 9.92725C23.8438 10.4105 23.4064 10.8022 22.867 10.8022H5.13302C4.59356 10.8022 4.15625 10.4105 4.15625 9.92725Z"
                fill="#262626"
                fillRule="evenodd"
              />
              <path
                d="M4.15625 18.0725C4.15625 17.5893 4.60928 17.1975 5.16811 17.1975H16.9256C17.4845 17.1975 17.9375 17.5893 17.9375 18.0725C17.9375 18.5558 17.4845 18.9475 16.9256 18.9475H5.16811C4.60928 18.9475 4.15625 18.5558 4.15625 18.0725Z"
                fill="#262626"
                fillRule="evenodd"
              />
            </svg>
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: "15px",
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          <button
            style={{ border: "none", background: "none" }}
            onClick={handleNew}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 5.70459C9.40419 5.70459 5.68222 9.42054 5.68222 13.9999C5.68222 15.8636 6.29743 17.5816 7.33699 18.9663C7.52584 19.2178 7.56514 19.5514 7.43993 19.8399L6.4611 22.0957L6.37453 22.2952H6.56445H14C18.5958 22.2952 22.3178 18.5792 22.3178 13.9999C22.3178 9.42054 18.5958 5.70459 14 5.70459ZM3.93222 13.9999C3.93222 8.45 8.44174 3.95459 14 3.95459C19.5583 3.95459 24.0678 8.45 24.0678 13.9999C24.0678 19.5498 19.5583 24.0452 14 24.0452H5.04103C4.7462 24.0452 4.4712 23.8967 4.30946 23.6502C4.14771 23.4037 4.12098 23.0923 4.23834 22.8219L5.63809 19.5961C4.56105 17.9968 3.93222 16.0706 3.93222 13.9999Z"
                fill="#000000"
                fillRule="evenodd"
              />
              <path
                d="M14 18.1562C13.5168 18.1562 13.125 17.7645 13.125 17.2812V10.7188C13.125 10.2355 13.5168 9.84375 14 9.84375C14.4832 9.84375 14.875 10.2355 14.875 10.7188V17.2812C14.875 17.7645 14.4832 18.1562 14 18.1562Z"
                fill="#000000"
                fillRule="evenodd"
              />
              <path
                d="M9.84375 14C9.84375 13.5168 10.2355 13.125 10.7188 13.125H17.2813C17.7645 13.125 18.1563 13.5168 18.1563 14C18.1563 14.4832 17.7645 14.875 17.2813 14.875H10.7188C10.2355 14.875 9.84375 14.4832 9.84375 14Z"
                fill="#000000"
                fillRule="evenodd"
              />
            </svg>
          </button>
        </header>

        {/* Main Content */}
        {messages.length ? (
          <main
            ref={mainRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              height: 0,
              padding: "30px 15px",
              overflow: "auto",
            }}
          >
            {messages.map((message, index) => {
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent:
                      message.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: "20px",
                    width: "100%",
                  }}
                >
                  {message.role === "assistant" ? (
                    <div style={{ width: "100%", display: "flex" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "999px",
                            border: "1.5px solid #D5D5D5",
                            marginTop: "5.5px",
                          }}
                        >
                          <img
                            style={{ width: "22px", height: "22px" }}
                            src={"./assets/logo.svg"}
                            alt="assistant"
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          maxWidth: "100%",
                          padding: "0px 16px",
                          lineHeight: "28px",
                          fontSize: "16px",
                          letterSpacing: "2px",
                          color: "#000",
                        }}
                      >
                        {/* https://github.com/remarkjs/react-markdown */}
                        <Markdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ children }) => (
                              <div style={{ margin: "0.5em 0" }}>
                                {children}
                              </div>
                            ),
                            table: ({ children }) => (
                              <table
                                style={{
                                  borderCollapse: "collapse",
                                  width: "100%",
                                  margin: "1em 0",
                                }}
                              >
                                {children}
                              </table>
                            ),
                            th: ({ children }) => (
                              <th
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "8px",
                                  backgroundColor: "#f5f5f5",
                                }}
                              >
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "8px",
                                }}
                              >
                                {children}
                              </td>
                            ),
                            pre: ({ children }) => children,
                            code: ({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }) => {
                              const match = /language-(\w+)/.exec(
                                className || ""
                              );
                              const language = match ? match[1] : "";

                              return !inline ? (
                                <CodeBlock language={language}>
                                  {children}
                                </CodeBlock>
                              ) : (
                                <code
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-all",
                                    wordWrap: "break-word",
                                    padding: "2px 4px",
                                    backgroundColor: "rgba(175, 184, 193, 0.2)",
                                    borderRadius: "4px",
                                    fontSize: "0.9em",
                                    maxWidth: "100%",
                                  }}
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </Markdown>
                        {message.content && !message.loading && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              color: "#8D8D8D",
                              marginTop: "16px",
                              gap: "16px",
                            }}
                          >
                            <svg
                              viewBox="0 0 1024 1024"
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              onClick={() => handleCopy(message)}
                            >
                              <path
                                d="M269.653333 749.860571c-12.678095 0-25.84381-0.975238-38.521904-3.900952a206.750476 206.750476 0 0 1-70.704762-29.257143 206.262857 206.262857 0 0 1-29.744762-24.868571c-9.264762-9.264762-17.554286-19.504762-24.380953-30.232381-7.314286-10.727619-13.653333-22.430476-18.529523-34.133334-4.87619-12.190476-8.289524-24.380952-11.215239-37.546666C74.118095 577.243429 73.142857 564.565333 73.142857 551.399619v-268.190476c0-13.165714 0.975238-25.84381 3.413333-39.009524 2.925714-12.678095 6.339048-24.868571 11.215239-37.059048s11.215238-23.405714 18.529523-34.133333c6.826667-11.215238 15.11619-20.967619 24.380953-30.232381s19.017143-17.554286 29.744762-24.868571c10.727619-7.314286 21.942857-13.165714 34.133333-18.041905 11.702857-5.36381 23.893333-8.777143 36.571429-11.702857 12.678095-2.438095 25.84381-3.413333 38.521904-3.413334h266.24c12.678095 0 25.35619 0.975238 38.034286 3.413334 12.678095 2.925714 24.868571 6.339048 37.059048 11.702857 11.702857 4.87619 23.405714 10.727619 34.133333 18.041905 10.727619 7.314286 20.48 15.60381 29.744762 24.868571s17.066667 19.017143 24.380952 30.232381a202.361905 202.361905 0 0 1 29.257143 71.192381c2.925714 13.165714 3.900952 25.84381 3.900953 39.009524h-77.04381c0-7.801905-0.975238-15.60381-2.438095-23.893333a131.169524 131.169524 0 0 0-6.826667-22.430477 124.294095 124.294095 0 0 0-43.885714-54.125714 119.174095 119.174095 0 0 0-43.398095-18.041905c-7.314286-1.462857-15.11619-2.438095-22.918096-2.438095H269.653333c-7.801905 0-15.60381 0.975238-23.405714 2.438095-7.314286 1.462857-15.11619 3.900952-22.430476 6.826667a120.05181 120.05181 0 0 0-38.521905 26.331429 106.008381 106.008381 0 0 0-25.843809 39.009523c-2.925714 7.314286-5.36381 15.11619-6.826667 22.430477-1.462857 8.289524-2.438095 16.091429-2.438095 23.893333v268.190476a127.122286 127.122286 0 0 0 9.264762 46.32381c2.925714 7.314286 6.339048 14.140952 10.727619 20.48 4.388571 6.826667 9.264762 12.678095 15.11619 18.529523 5.36381 5.36381 11.702857 10.727619 18.041905 15.116191s13.653333 7.801905 20.48 11.215238c7.314286 2.925714 15.11619 4.87619 22.430476 6.826667 7.801905 1.462857 15.60381 1.950476 23.405714 1.950476v78.019047z"
                                fill="currentColor"
                              ></path>
                              <path
                                d="M743.619048 958.073905H477.866667a202.361905 202.361905 0 0 1-75.580953-15.116191 231.131429 231.131429 0 0 1-34.133333-18.529524 206.262857 206.262857 0 0 1-54.125714-54.613333c-7.314286-11.215238-13.165714-22.430476-18.041905-34.620952-4.87619-12.190476-8.777143-24.380952-11.215238-37.059048-2.925714-12.678095-3.900952-25.84381-3.900953-39.009524v-268.190476c0-13.165714 0.975238-25.84381 3.900953-38.521905 2.438095-12.678095 6.339048-25.35619 11.215238-37.546666 4.87619-11.702857 10.727619-23.405714 18.041905-34.133334 7.314286-10.727619 15.11619-20.967619 24.380952-30.232381s19.017143-17.554286 29.744762-24.380952a193.29219 193.29219 0 0 1 109.714286-33.645714h265.752381c12.678095 0 25.84381 1.462857 38.521904 3.900952s24.868571 6.339048 36.571429 11.215238c12.190476 4.87619 23.405714 11.215238 34.133333 18.529524 10.727619 6.826667 20.48 15.11619 29.744762 24.380952s17.554286 19.504762 24.380953 30.232381c7.314286 10.727619 13.165714 22.430476 18.529523 34.133334 4.87619 12.190476 8.289524 24.868571 11.215238 37.546666 2.438095 12.678095 3.413333 25.35619 3.413334 38.521905v268.190476c0 13.165714-0.975238 26.331429-3.413334 39.009524-2.925714 12.678095-6.339048 24.868571-11.215238 37.059048-5.36381 12.190476-11.215238 23.405714-18.529523 34.620952-6.826667 10.727619-15.11619 20.48-24.380953 29.744762s-19.017143 17.554286-29.744762 24.868571c-10.727619 7.314286-21.942857 13.165714-34.133333 18.529524-11.702857 4.87619-23.893333 8.777143-36.571429 11.215238-12.678095 2.438095-25.84381 3.900952-38.521904 3.900953zM477.866667 370.492952c-8.289524 0-16.091429 0.487619-23.405715 2.438096-7.801905 1.462857-15.11619 3.413333-22.430476 6.826666-7.314286 2.925714-14.140952 6.339048-20.967619 11.215238-6.339048 4.388571-12.190476 9.264762-18.041905 14.628572-5.36381 5.851429-10.24 11.702857-14.628571 18.529524-4.388571 6.339048-8.289524 13.653333-11.215238 20.48a127.122286 127.122286 0 0 0-9.264762 46.323809v268.190476c0 8.289524 0.975238 16.091429 2.438095 23.893334a119.174095 119.174095 0 0 0 18.041905 43.398095c4.388571 6.339048 9.264762 12.678095 14.628571 18.041905 5.851429 5.851429 11.702857 10.727619 18.041905 15.11619a119.174095 119.174095 0 0 0 43.398095 18.041905c7.314286 1.462857 15.11619 2.438095 23.405715 2.438095h265.752381c7.801905 0 15.60381-0.975238 23.405714-2.438095 7.314286-1.462857 15.11619-3.900952 22.430476-6.826667a120.05181 120.05181 0 0 0 38.521905-26.331428c5.36381-5.36381 10.727619-11.702857 15.11619-18.041905 3.900952-6.826667 7.801905-13.653333 10.727619-20.967619 2.925714-7.314286 5.36381-14.628571 6.826667-22.430476 1.462857-7.801905 2.438095-15.60381 2.438095-23.893334v-268.190476a127.122286 127.122286 0 0 0-9.264762-46.323809c-2.925714-6.826667-6.826667-14.140952-10.727619-20.48-4.388571-6.826667-9.752381-12.678095-15.11619-18.529524a131.364571 131.364571 0 0 0-38.521905-25.84381 98.499048 98.499048 0 0 0-22.430476-6.826666c-7.801905-1.950476-15.60381-2.438095-23.405714-2.438096H477.866667z"
                                fill="currentColor"
                              ></path>
                            </svg>

                            <svg
                              viewBox="0 0 1024 1024"
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              onClick={() => handleRefresh(message)}
                            >
                              <path
                                d="M13.653333 45.83619h975.238096v975.238096h-975.238096z"
                                fill="currentColor"
                                fillOpacity="0"
                              ></path>
                              <path
                                d="M843.093333 417.889524l-147.748571-0.487619c-4.87619 0-9.264762-0.975238-13.653333-2.925715a42.325333 42.325333 0 0 1-11.215239-7.801904 29.647238 29.647238 0 0 1-7.314285-11.702857 32.719238 32.719238 0 0 1 0-27.306667c1.462857-4.388571 3.900952-8.289524 7.314285-11.702857 3.413333-2.925714 7.314286-5.851429 11.215239-7.314286 4.388571-1.950476 8.777143-2.925714 13.653333-2.925714l77.531428 0.487619a35.742476 35.742476 0 0 0 24.868572-10.727619c3.413333-3.413333 5.851429-7.314286 7.314286-11.702857 1.950476-4.388571 2.925714-8.777143 2.925714-13.653334l0.487619-74.605714c0-4.87619 0.975238-9.264762 2.925714-13.653333 1.462857-4.388571 3.900952-8.289524 7.314286-11.702857 3.413333-3.413333 7.314286-5.851429 11.215238-7.801905 4.388571-1.950476 8.777143-2.438095 13.653333-2.438095 4.388571 0 8.777143 0.487619 13.165715 2.438095 4.388571 1.950476 8.289524 4.388571 11.215238 7.801905 3.413333 3.413333 5.851429 7.314286 7.801905 11.702857 1.462857 4.388571 2.438095 8.777143 2.438095 13.653333l-0.487619 146.773333c0 4.87619-0.487619 9.264762-2.438096 13.653334-1.950476 4.388571-4.388571 7.801905-7.314285 11.215238-3.413333 3.413333-7.314286 5.851429-11.215238 7.801905-4.388571 1.950476-8.777143 2.925714-13.653334 2.925714zM126.293333 840.167619l0.487619-145.798095c0-4.388571 0.975238-9.264762 2.438096-13.653334a37.839238 37.839238 0 0 1 19.017142-19.504761 32.182857 32.182857 0 0 1 13.165715-2.925715l148.23619 0.487619c4.388571 0 8.777143 0.975238 13.165715 2.925715 4.388571 1.950476 8.289524 4.388571 11.215238 7.801904 3.413333 3.413333 5.851429 7.314286 7.801904 11.702858 1.462857 4.388571 2.438095 9.264762 2.438096 14.140952 0 4.388571-0.975238 9.264762-2.438096 13.653333-1.950476 4.388571-4.388571 8.289524-7.801904 11.702857-2.925714 3.413333-6.826667 5.851429-11.215238 7.801905a32.182857 32.182857 0 0 1-13.165715 2.925714l-78.019047-0.487619a32.182857 32.182857 0 0 0-13.165715 2.925715c-4.388571 1.950476-8.289524 4.388571-11.215238 7.801904-3.413333 3.413333-5.851429 7.314286-7.801905 11.702858a45.348571 45.348571 0 0 0-2.438095 14.140952l-0.487619 72.655238c0 4.87619-0.975238 9.264762-2.925714 14.140952-1.950476 4.388571-4.388571 8.289524-7.314286 11.702858-3.413333 3.413333-7.314286 5.851429-11.702857 7.801904a37.205333 37.205333 0 0 1-26.331429 0 37.839238 37.839238 0 0 1-11.702857-7.801904 36.473905 36.473905 0 0 1-7.314285-11.702858 34.962286 34.962286 0 0 1-2.925715-14.140952z"
                                fill="currentColor"
                              ></path>
                              <path
                                d="M495.420952 924.038095c-18.041905 0-35.59619-0.975238-53.150476-3.413333-18.041905-2.438095-35.108571-5.851429-52.662857-10.24-17.066667-4.87619-33.645714-10.727619-50.224762-17.554286-16.579048-6.826667-32.182857-14.628571-47.786667-23.405714-15.11619-9.264762-29.744762-19.017143-43.885714-29.744762-13.653333-11.215238-26.819048-22.918095-39.497143-35.59619-12.190476-12.678095-23.893333-25.84381-34.133333-39.984762-10.727619-14.140952-19.992381-29.257143-28.769524-44.373334l70.704762-37.546666c8.289524 14.628571 17.554286 28.769524 27.794286 41.935238 10.24 13.165714 21.942857 25.35619 34.133333 36.571428 12.190476 11.702857 25.35619 21.942857 39.497143 31.207619 14.140952 9.264762 29.257143 17.554286 44.373333 24.868572a344.84419 344.84419 0 0 0 97.52381 26.819047c17.066667 1.462857 33.645714 1.950476 50.712381 1.462858 17.066667-0.975238 33.645714-2.925714 50.712381-6.339048 16.579048-3.413333 32.670476-8.289524 48.274285-14.140952 16.091429-6.339048 31.207619-13.165714 45.836191-21.455239 14.628571-8.777143 28.769524-18.041905 41.935238-28.769523a307.102476 307.102476 0 0 0 66.80381-74.605715c9.264762-14.140952 17.066667-28.769524 23.893333-44.373333 6.339048-15.11619 11.702857-30.72 16.091428-47.299048 3.900952-16.091429 6.826667-32.182857 7.801905-49.249523a43.885714 43.885714 0 0 1 3.900953-13.653334 36.961524 36.961524 0 0 1 20.48-19.504762c4.87619-1.950476 9.264762-3.413333 14.628571-3.413333 5.36381 0 10.727619 0.975238 16.091429 2.925714a39.594667 39.594667 0 0 1 22.918095 22.918096c1.950476 5.36381 2.438095 10.727619 1.950476 16.579047-0.975238 12.190476-2.438095 23.893333-4.388571 36.08381-2.438095 11.702857-4.87619 23.893333-8.289524 35.59619-2.925714 11.702857-6.826667 22.918095-11.215238 34.620953-4.388571 11.215238-9.264762 22.430476-14.628572 33.158095-5.36381 11.215238-11.215238 21.942857-17.554285 32.182857-6.826667 10.24-13.653333 20.48-20.967619 30.232381-7.314286 9.752381-15.11619 19.017143-23.405715 28.281905-8.289524 8.777143-17.066667 17.554286-25.843809 25.843809-9.264762 8.289524-18.529524 16.091429-28.281905 23.405714-9.752381 7.314286-19.992381 14.140952-30.72 20.48-10.24 6.826667-20.967619 12.678095-32.182857 18.041905-11.215238 5.36381-22.430476 10.24-33.645714 14.628572-11.702857 4.388571-23.405714 8.289524-35.108572 11.702857-12.190476 3.413333-23.893333 6.339048-36.083809 8.289524-12.190476 2.438095-24.380952 4.388571-37.059048 5.363809-12.190476 0.975238-24.380952 1.462857-36.571429 1.462857zM152.624762 546.620952a38.180571 38.180571 0 0 1-16.579048-2.438095 45.007238 45.007238 0 0 1-13.653333-9.264762 34.084571 34.084571 0 0 1-9.264762-14.140952C111.177143 515.413333 110.689524 510.049524 111.177143 504.685714c1.462857-20.967619 4.87619-41.447619 9.752381-61.44 4.87619-20.48 11.215238-39.984762 19.504762-59.001904 7.801905-19.504762 17.554286-38.034286 28.769524-55.588572 10.727619-17.554286 23.405714-34.133333 37.059047-50.224762 14.140952-15.60381 28.769524-30.232381 45.348572-43.398095 16.091429-13.653333 33.158095-25.84381 51.2-36.571429 18.041905-10.727619 37.059048-19.504762 56.563809-27.306666 19.992381-7.801905 39.984762-14.140952 60.464762-18.529524 20.48-4.87619 41.447619-7.801905 62.902857-8.777143 20.967619-1.462857 41.935238-0.975238 62.902857 0.975238 21.455238 1.950476 41.935238 5.36381 62.415238 10.727619 20.48 5.36381 40.472381 12.190476 59.977143 20.48a420.62019 420.62019 0 0 1 105.813334 67.291429c15.60381 14.140952 30.232381 28.769524 43.398095 45.348571 13.165714 16.091429 25.35619 33.158095 35.59619 51.2l-69.729524 39.009524a291.59619 291.59619 0 0 0-28.281904-40.96c-10.727619-12.678095-22.430476-24.868571-34.620953-36.08381a312.07619 312.07619 0 0 0-40.472381-30.23238c-14.140952-8.777143-28.769524-16.579048-44.373333-23.405715-15.11619-6.826667-31.207619-12.190476-47.786667-16.091428a281.84381 281.84381 0 0 0-49.249523-8.777143c-17.066667-1.462857-33.645714-1.950476-50.712381-0.975238-17.066667 0.975238-33.645714 3.413333-50.224762 7.314285-16.091429 3.413333-32.182857 8.289524-47.786667 14.628572a307.833905 307.833905 0 0 0-86.308571 50.712381c-13.165714 10.727619-24.868571 22.430476-36.08381 35.108571-11.215238 12.190476-20.967619 25.84381-29.744762 39.984762-8.777143 14.140952-16.579048 28.769524-22.918095 43.885714-6.826667 15.60381-11.702857 31.207619-15.60381 47.299048-3.900952 16.091429-6.826667 32.670476-7.801904 49.249524-0.487619 4.388571-1.950476 9.264762-3.900953 13.653333-1.950476 4.388571-4.87619 8.289524-8.289524 11.702857a40.033524 40.033524 0 0 1-26.331428 10.727619z"
                                fill="currentColor"
                              ></path>
                            </svg>

                            <svg
                              viewBox="0 0 1024 1024"
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                            >
                              <path
                                d="M411.904 153.728c19.797333-63.232 54.186667-90.24 122.026667-70.656l1.706666 0.554667c19.84 6.101333 42.666667 17.706667 64.085334 37.162666 33.706667 30.72 53.76 73.301333 53.76 126.805334 0 47.786667-2.773333 77.312-10.88 110.805333l-0.256 0.938667h175.488c107.264 0 149.888 72.362667 122.922666 192.682666l-2.304 9.856-5.461333 18.005334-20.608 67.114666-9.642667 30.677334-9.173333 28.672-17.066667 51.626666-11.648 33.621334-7.210666 20.053333-9.984 26.368-6.101334 15.232c-29.525333 71.253333-90.453333 103.978667-170.112 94.592l-387.114666-28.8a587.690667 587.690667 0 0 0-7.381334-0.341333l-15.36-0.341334H218.026667l-12.501334-0.213333-9.984-0.426667-8.32-0.768-3.712-0.554666-7.125333-1.408-11.52-3.029334c-59.349333-17.621333-90.24-67.925333-90.24-139.605333v-283.52c0-90.538667 54.954667-142.208 148.565333-142.208l75.776-0.042667 5.205334-3.968a293.632 293.632 0 0 0 72.234666-88.32l6.101334-11.946666c6.101333-12.544 11.093333-25.685333 15.829333-41.002667l0.768-2.602667z m88.661333 8.064c-1.834667-0.426667-2.645333 0.170667-3.541333 2.773333l-3.882667 14.933334-10.666666 38.442666-2.56 8.533334a366.933333 366.933333 0 0 1-20.565334 53.162666 387.754667 387.754667 0 0 1-72.618666 102.442667 333.141333 333.141333 0 0 1-49.28 42.026667l5.504-3.925334v417.408l336.682666 25.344c41.898667 4.906667 65.621333-6.101333 80.213334-36.096l2.858666-6.229333 5.76-14.378667 9.514667-25.173333 6.912-19.285333 11.221333-32.469334 8.064-24.064 17.365334-53.76 19.2-61.354666 15.445333-50.858667c18.986667-76.074667 7.808-94.592-38.357333-94.592h-217.685334a53.632 53.632 0 0 1-50.730666-71.125333l2.176-6.4 3.328-10.922667c10.282667-35.754667 13.226667-59.136 13.226666-108.629333 0-48.426667-26.88-72.96-57.045333-82.261334l-3.712-1.152z m-242.944 270.122667h-34.389333c-47.616 0-63.232 14.72-63.232 56.917333v283.52c0 38.016 9.941333 53.333333 33.792 59.008l1.493333 0.341333 3.754667 0.554667 5.12 0.426667 11.562667 0.256h28.586666l13.312 0.085333v-401.066667z"
                                fill="currentColor"
                              ></path>
                            </svg>

                            <svg
                              style={{
                                transform: "rotate(180deg) scaleX(-1)",
                              }}
                              viewBox="0 0 1024 1024"
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                            >
                              <path
                                d="M411.904 153.728c19.797333-63.232 54.186667-90.24 122.026667-70.656l1.706666 0.554667c19.84 6.101333 42.666667 17.706667 64.085334 37.162666 33.706667 30.72 53.76 73.301333 53.76 126.805334 0 47.786667-2.773333 77.312-10.88 110.805333l-0.256 0.938667h175.488c107.264 0 149.888 72.362667 122.922666 192.682666l-2.304 9.856-5.461333 18.005334-20.608 67.114666-9.642667 30.677334-9.173333 28.672-17.066667 51.626666-11.648 33.621334-7.210666 20.053333-9.984 26.368-6.101334 15.232c-29.525333 71.253333-90.453333 103.978667-170.112 94.592l-387.114666-28.8a587.690667 587.690667 0 0 0-7.381334-0.341333l-15.36-0.341334H218.026667l-12.501334-0.213333-9.984-0.426667-8.32-0.768-3.712-0.554666-7.125333-1.408-11.52-3.029334c-59.349333-17.621333-90.24-67.925333-90.24-139.605333v-283.52c0-90.538667 54.954667-142.208 148.565333-142.208l75.776-0.042667 5.205334-3.968a293.632 293.632 0 0 0 72.234666-88.32l6.101334-11.946666c6.101333-12.544 11.093333-25.685333 15.829333-41.002667l0.768-2.602667z m88.661333 8.064c-1.834667-0.426667-2.645333 0.170667-3.541333 2.773333l-3.882667 14.933334-10.666666 38.442666-2.56 8.533334a366.933333 366.933333 0 0 1-20.565334 53.162666 387.754667 387.754667 0 0 1-72.618666 102.442667 333.141333 333.141333 0 0 1-49.28 42.026667l5.504-3.925334v417.408l336.682666 25.344c41.898667 4.906667 65.621333-6.101333 80.213334-36.096l2.858666-6.229333 5.76-14.378667 9.514667-25.173333 6.912-19.285333 11.221333-32.469334 8.064-24.064 17.365334-53.76 19.2-61.354666 15.445333-50.858667c18.986667-76.074667 7.808-94.592-38.357333-94.592h-217.685334a53.632 53.632 0 0 1-50.730666-71.125333l2.176-6.4 3.328-10.922667c10.282667-35.754667 13.226667-59.136 13.226666-108.629333 0-48.426667-26.88-72.96-57.045333-82.261334l-3.712-1.152z m-242.944 270.122667h-34.389333c-47.616 0-63.232 14.72-63.232 56.917333v283.52c0 38.016 9.941333 53.333333 33.792 59.008l1.493333 0.341333 3.754667 0.554667 5.12 0.426667 11.562667 0.256h28.586666l13.312 0.085333v-401.066667z"
                                fill="currentColor"
                              ></path>
                            </svg>
                          </div>
                        )}
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
        <footer
          style={{
            padding: "0 16px",
            marginBottom: "16px",
            display: "flex",
            gap: "8px",
            position: "relative",
            width: "100%",
            height: "48px",
          }}
        >
          <TextArea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="给 DeepSeek 发送消息"
            autoSize={{ minRows: 1, maxRows: 6 }}
            className="deepseek-message-input"
            styles={{
              borderRadius: "24px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // 移动设备上忽略回车键事件
                if (isMobile) return;

                // 电脑端保持原有行为
                if (!e.shiftKey) {
                  e.preventDefault(); // 阻止默认的换行行为
                  handleSendMessage();
                }
              }
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              position: "absolute",
              right: "24px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "999px",
                backgroundColor: "#3E81F6",
                color: "#fff",
                opacity: message.length || isSending ? 1 : 0.4,
              }}
              onClick={(e) => {
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
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M12.5,9.25L7,14.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M1.5,9.25L7,14.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}
            </div>
          </div>
        </footer>
      </div>
      <Drawer
        placement="left"
        size="default"
        width={300}
        closable={false}
        onClose={handleCloseDrawer}
        open={drawerOpen}
        key="left"
      >
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <ul style={{ flex: 1, height: 0, overflow: "auto" }}>
            {/* 今天 */}
            {groupedMessages.today.length > 0 && (
              <li style={{ marginBottom: "12px" }}>
                <span style={{ color: "#999", fontSize: "14px" }}>今天</span>
                <ul style={{ marginTop: "12px" }}>
                  {groupedMessages.today.map((message) => (
                    <li
                      onClick={() => {
                        setActiveMessage(message.id);
                        handleCloseDrawer();
                      }}
                      key={message.id}
                      className="menu-item"
                      style={{
                        marginTop: "4px",
                        height: 44,
                        lineHeight: "44px",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {message.list[0].content}
                    </li>
                  ))}
                </ul>
              </li>
            )}

            {/* 昨天 */}
            {groupedMessages.yesterday.length > 0 && (
              <li style={{ marginBottom: "12px" }}>
                <span style={{ color: "#999", fontSize: "14px" }}>昨天</span>
                <ul style={{ marginTop: "12px" }}>
                  {groupedMessages.yesterday.map((message) => (
                    <li
                      onClick={() => {
                        setActiveMessage(message.id);
                        handleCloseDrawer();
                      }}
                      key={message.id}
                      className="menu-item"
                      style={{
                        marginTop: "4px",
                        height: 44,
                        lineHeight: "44px",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {message.list[0].content}
                    </li>
                  ))}
                </ul>
              </li>
            )}

            {/* 本周 */}
            {groupedMessages.week.length > 0 && (
              <li style={{ marginBottom: "12px" }}>
                <span style={{ color: "#999", fontSize: "14px" }}>本周</span>
                <ul style={{ marginTop: "12px" }}>
                  {groupedMessages.week.map((message) => (
                    <li
                      onClick={() => {
                        setActiveMessage(message.id);
                        handleCloseDrawer();
                      }}
                      key={message.id}
                      className="menu-item"
                      style={{
                        marginTop: "4px",
                        height: 44,
                        lineHeight: "44px",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {message.list[0].content}
                    </li>
                  ))}
                </ul>
              </li>
            )}

            {/* 本月 */}
            {groupedMessages.month.length > 0 && (
              <li style={{ marginBottom: "12px" }}>
                <span style={{ color: "#999", fontSize: "14px" }}>本月</span>
                <ul style={{ marginTop: "12px" }}>
                  {groupedMessages.month.map((message) => (
                    <li
                      onClick={() => {
                        setActiveMessage(message.id);
                        handleCloseDrawer();
                      }}
                      key={message.id}
                      className="menu-item"
                      style={{
                        marginTop: "4px",
                        height: 44,
                        lineHeight: "44px",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {message.list[0].content}
                    </li>
                  ))}
                </ul>
              </li>
            )}

            {/* 更早 */}
            {groupedMessages.older.length > 0 && (
              <li style={{ marginBottom: "12px" }}>
                <span style={{ color: "#999", fontSize: "14px" }}>更早</span>
                <ul style={{ marginTop: "12px" }}>
                  {groupedMessages.older.map((message) => (
                    <li
                      onClick={() => {
                        setActiveMessage(message.id);
                        handleCloseDrawer();
                      }}
                      key={message.id}
                      className="menu-item"
                      style={{
                        marginTop: "4px",
                        height: 44,
                        lineHeight: "44px",
                      }}
                    >
                      {message.list[0].content}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
          <Divider />
          <Button type="dashed" danger onClick={handleClear}>
            一键清空
          </Button>
        </div>
      </Drawer>
    </>
  );
}

export default App;
