import io from "socket.io-client";
import React from 'react';
import store from '../store';
import lobbySlice from "../lobbySlice";
import { useSelector } from "react-redux";
import ReactDOM from 'react-dom/client';
import { useNavigate } from 'react-router-dom';
import Header from '../features/header/Header';

export const socket = io.connect('https://royal-games.replit.app');
// export const socket = io.connect('http://localhost:8080');
export const SocketContext = React.createContext();

socket.on('connect', () => {

  socket.emit('login', {
    key: localStorage.getItem('key'),
  });
  const waitForLoginTimeout = setTimeout(() => {
    // propably invalid key in localStorage
    localStorage.removeItem('key');

    socket.emit('login', {
      key: localStorage.getItem('key'),
    });
  }, 5000);

  socket.on('login', (data) => {
    clearTimeout(waitForLoginTimeout);

    if (data.status === 'logged-in') {
      localStorage.setItem('key', data.key);

      store.dispatch(lobbySlice.actions.updateLoginState({
        status: data.status,
        username: data.username,
      }));
      store.dispatch(lobbySlice.actions.updateBalance(data.balance));
    } else {
      const loggedIn = useSelector((state) => state.lobby.loggedIn);
      if (!loggedIn) {
        // Open the modal with the login form when the user is not logged in
        const headerElement = document.getElementById('header');
        const headerInstance = ReactDOM.render(<Header />, headerElement);
        headerInstance.toggleModal();
      }
    }
  });
});

socket.on('disconnect', () => {
  store.dispatch(lobbySlice.actions.updateLoginState('logged-out'));
  store.dispatch(lobbySlice.actions.updateBalance(0));
});