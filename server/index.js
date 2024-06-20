const sqlite3 = require('sqlite3').verbose();
const md5 = require('md5');
const { v1: uuidv1 } = require('uuid');
const Server = require('./server');
const rockClimberData = require('./games-data/rock-climber');
const egyptianTreasuresData = require('./games-data/egyptian-treasures');

let db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const createAccountsTable = `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      balance REAL,
      key TEXT,
      last_login INTEGER
    )`;

  const createGamestatesTable = `
    CREATE TABLE IF NOT EXISTS gamestates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      game_id TEXT,
      reels TEXT,
      bet REAL,
      coin_value REAL,
      FOREIGN KEY(user_id) REFERENCES accounts(id)
    )`;

  db.serialize(() => {
    db.run(createAccountsTable, (err) => {
      if (err) {
        console.error("Error creating accounts table:", err.message);
        return;
      }
      console.log("Accounts table created or already exists.");
    });

    db.run(createGamestatesTable, (err) => {
      if (err) {
        console.error("Error creating gamestates table:", err.message);
        return;
      }
      console.log("Gamestates table created or already exists.");

      const server = new Server();
      const io = server.start();

      initIo(io);
    });
  });
}

process.on('exit', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
  });
});

function initIo(io) {
  io.on('connection', (socket) => {
    socket.on('login', async (data) => {
      if (data.key === null) {
        const key = md5(uuidv1());
        const username = 'Guest';
        const balance = 10000.00;
        try {
          await createNewUser(username, balance, key);
          socket.emit('login', {
            status: 'logged-in',
            key,
            username,
            balance,
          });
        } catch (err) {
          console.log(err);
          socket.emit('login-error', { message: 'Failed to create a new user.' });
        }
      } else {
        try {
          const user = await getUser(data.key);
          socket.emit('login', {
            status: 'logged-in',
            key: data.key,
            username: user.username,
            balance: user.balance,
          });
        } catch (err) {
          console.log(err);
          socket.emit('login-error', { message: 'Failed to retrieve user data.' });
        }
      }
    });

    socket.on('balance', async (data) => {
      try {
        const account = await getUser(data.key);
        socket.emit('balance', account.balance);
      } catch (err) {
        console.log(err);
        socket.emit('balance-error', { message: 'Failed to retrieve balance.' });
      }
    });

    socket.on('gamestate', async (data) => {
      try {
        const account = await getUser(data.key);
        const gamestate = await getOrCreateGamestate(account.id, data.gameId);
        socket.emit('gamestate', {
          balance: account.balance,
          bet: gamestate.bet,
          coinValue: gamestate.coin_value,
          reels: JSON.parse(gamestate.reels),
        });
      } catch (err) {
        console.log(err);
        socket.emit('gamestate-error', { message: 'Failed to retrieve game state.' });
      }
    });

    socket.on('bet', async (data) => {
      try {
        const account = await getUser(data.key);
        const bet = parseFloat(data.bet);
        const coinValue = parseFloat(data.coinValue);
        const betAmount = Math.round((bet * 10 * coinValue) * 100) / 100;

        if (isNaN(bet) || isNaN(coinValue) || isNaN(betAmount)) {
          throw new Error('Invalid bet or coin value');
        }

        if (account.balance >= betAmount) {
          const betResult = generateBetResult(data.gameId, betAmount);
          let winAmount = 0;
          betResult.lines.forEach((line) => {
            winAmount += line.amount;
          });

          const newBalance = Math.round((account.balance - betAmount + winAmount) * 100) / 100;

          await updateBalance(account.id, newBalance);
          await updateGamestate(account.id, data.gameId, bet, coinValue, JSON.stringify(betResult.position));

          socket.emit('bet', {
            balance: newBalance,
            reels: betResult.position,
            isWin: betResult.lines.length > 0,
            win: betResult.lines,
          });
        } else {
          socket.emit('bet-error', { message: 'Insufficient balance.' });
        }
      } catch (err) {
        console.log(err);
        socket.emit('bet-error', { message: 'Failed to process bet.' });
      }
    });
  });
}

function generateRandomReelsPosition(gameId) {
  const position = [];
  let reelsCount, reelPositions, symbolsCount;

  switch (gameId) {
    case 'rock-climber':
      reelsCount = rockClimberData.reelsCount;
      reelPositions = rockClimberData.reelPositions;
      symbolsCount = rockClimberData.symbolsCount;
      break;
    case 'egyptian-treasures':
      reelsCount = egyptianTreasuresData.reelsCount;
      reelPositions = egyptianTreasuresData.reelPositions;
      symbolsCount = egyptianTreasuresData.symbolsCount;
      break;
  }

  for (let i = 0; i < reelsCount; i++) {
    position.push(Array.from(Array(reelPositions + 1)).map(() => {
      return parseInt(Math.random() * symbolsCount) + 1;
    }));
  }

  return position;
}

function generateBetResult(gameId, betAmount) {
  const position = generateRandomReelsPosition(gameId);
  const lines = processReelsPosition(gameId, betAmount, position);

  return {
    position,
    lines,
  };
}

function processReelsPosition(gameId, betAmount, position) {
  const result = [];
  let linesPositions, symbolsMultipliers;

  switch (gameId) {
    case 'rock-climber':
      linesPositions = rockClimberData.linesPositions;
      symbolsMultipliers = rockClimberData.symbolsMultipliers;
      break;
    case 'egyptian-treasures':
      linesPositions = egyptianTreasuresData.linesPositions;
      symbolsMultipliers = egyptianTreasuresData.symbolsMultipliers;
      break;
  }

  linesPositions.forEach((linePosition, i) => {
    let symbolsInLine = [];
    for (let j = 0; j < linePosition.length; j++) {
      for (let k = 0; k < linePosition[j].length; k++) {
        if (linePosition[j][k] === 1) {
          symbolsInLine.push(position[j][k]);
        }
      }
    }

    let identicalSymbol = symbolsInLine[0];
    let identicalSymbolsCount = 1;
    for (let j = 1; j < symbolsInLine.length; j++) {
      if (identicalSymbol === symbolsInLine[j]) {
        identicalSymbolsCount++;
      } else {
        break;
      }
    }

    if (identicalSymbolsCount >= 3) {
      result.push({
        number: i + 1,
        symbol: identicalSymbol,
        count: identicalSymbolsCount,
        map: linePosition,
        amount: Math.round(betAmount * symbolsMultipliers[identicalSymbol][identicalSymbolsCount - 3].multiplier * 100) / 100,
      });
    }
  });

  return result;
}

function createNewUser(username, balance, key) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO accounts (username, balance, key) VALUES (?, ?, ?)`, [username, balance, key], function (err) {
      if (err) {
        reject(err.message);
      } else {
        resolve();
      }
    });
  });
}

function getUser(key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM accounts WHERE key = ?`, [key], function (err, row) {
      if (err) {
        reject(err.message);
      } else {
        resolve(row);
      }
    });
  });
}

function getOrCreateGamestate(userId, gameId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM gamestates WHERE user_id = ? AND game_id = ?`, [userId, gameId], function (err, rows) {
      if (err) {
        reject(err.message);
      } else if (rows.length === 1) {
        resolve(rows[0]);
      } else {
        let defaultBet, defaultCoinValue;
        switch (gameId) {
          case 'rock-climber':
            defaultBet = rockClimberData.defaultBet;
            defaultCoinValue = rockClimberData.defaultCoinValue;
            break;
          case 'egyptian-treasures':
            defaultBet = egyptianTreasuresData.defaultBet;
            defaultCoinValue = egyptianTreasuresData.defaultCoinValue;
            break;
        }
        const position = generateRandomReelsPosition(gameId);
        db.run(`INSERT INTO gamestates (user_id, game_id, reels, bet, coin_value) VALUES (?, ?, ?, ?, ?)`, [userId, gameId, JSON.stringify(position), defaultBet, defaultCoinValue], function (err) {
          if (err) {
            reject(err.message);
          } else {
            resolve({
              user_id: userId,
              game_id: gameId,
              reels: JSON.stringify(position),
              bet: defaultBet,
              coin_value: defaultCoinValue,
            });
          }
        });
      }
    });
  });
}

function updateBalance(userId, value) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE accounts SET balance = ? WHERE id = ?`, [value, userId], function (err) {
      if (err) {
        reject(err.message);
      } else {
        resolve();
      }
    });
  });
}

function updateGamestate(userId, gameId, bet, coinValue, reelsPosition) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE gamestates SET reels = ?, bet = ?, coin_value = ? WHERE user_id = ? AND game_id = ?`, [reelsPosition, bet, coinValue, userId, gameId], function (err) {
      if (err) {
        reject(err.message);
      } else {
        resolve();
      }
    });
  });
}
