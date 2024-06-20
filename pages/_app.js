// /pages/_app.js

import "../styles/App.scss";
import Header from "../components/header/Header";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Game from "../components/game/Game";
import GameList from "../components/game-list/GameList";
import Register from "../components/register/Register";
import Login from "../components/login/Login";
import { Fragment } from "react";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Fragment>
                <Header />
                <GameList />
              </Fragment>
            }
          />
          <Route path="/play/:gameId" element={<Game />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
