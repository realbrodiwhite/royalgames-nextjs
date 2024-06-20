// /pages/index.js

import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";
import App from "../pages/App";
import { SocketContext, socket } from "../src/context/socket";
import { Provider } from "react-redux";
import store from "../src/store";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  //  <React.StrictMode>
  //  <App />
  //  </React.StrictMode>
  <Provider store={store}>
    <SocketContext.Provider value={socket}>
      <App />
    </SocketContext.Provider>
  </Provider>,
);
