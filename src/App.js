import "./App.scss";
import Header from "./features/header/Header";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Game from "./features/game/Game";
import GameList from "./features/game-list/GameList";
import Register from "./features/register/Register";
import Login from "./features/login/Login";
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
