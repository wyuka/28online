import logging

import tornado.ioloop
import tornado.web
import tornado.websocket

from message import MessageWriter
from game import CardGame, ScoreKeeper
from cards import Card, HandInfo, PlayerMove
from player import HumanPlayer, Player

class GameServer:
    def __init__(self):
        self.players = []
        self.writer = None
        self.cardGame = None
        self.scores = None
        self.hand = None
        self.handlerQueue = []
        self.readyQueue = []
        self.gameStarted = False

    def addWriter(self, writer):
        self.writers.append(writer)

    def startGame(self, handler, req):
        nr = len(self.players)
        if nr == 4:
            message = {'response': 'roomFull'}
            logging.debug("Room is full")
            handler.sendMessage(message)
        else:
            if nr % 2 == 0:
                teamName = "Team A"
            else:
                teamName = "Team B"
            #player = Player(nr, req['playerName'], teamName)
            #FIXME: uncomment the previous line, just debugging
            player = HumanPlayer(nr, nr, teamName)
            self.players.append(player)
            self.handlerQueue.append(handler)
            if len(self.players) == 4:
                self.cardGame = CardGame(self.players)
                self.scores = ScoreKeeper(self.players)
                self.cardGame.startingPlayerIndex = 0
                self.cardGame.setPlayingOrder()
                self.gameStarted = True
                self.cardGame.dealFirstCards()
                self.cardGame.initCall()
            message = {'response': 'joinedGame', 'id': nr, 'name' : req['playerName'], 'team': teamName}
            logging.debug("%s added to room", req['playerName'])
            handler.sendMessage(message)

    def getGameInfo(self, handler, req):
        if self.gameStarted:
            message = {'response': 'gameInfo'}
            playersList = []
            i = 0
            for player in self.cardGame.getPlayers():
                playersList.append({'index': i, 'name': player.name,
                                    'id': player.id, 'team': player.team})
                i = i + 1

            message['players'] = playersList
            message['playingOrder'] = self.cardGame.getOrder()
            message['gameId'] = str(self.cardGame.id)

            self.broadcast(message)

    def dealFirstCards(self, handler, request):
        response = {'response': 'dealFirstCards'}
        try:
            player = self.cardGame.getPlayerById(request['playerId'])
            firstCards = player.getCards()
            logging.debug("Total nr of cards: %s", len(firstCards))

            response['cards'] = [{'rank': card.rank, 'suit': card.suit}
                           for card in firstCards]
        except Exception as ex:
            self.writer.sendError(ex)
            raise

        handler.sendMessage(response)

    def readyForCall(self, handler, request):
        if self.cardGame.callWon:
            response = {'response': 'callWon'}
            response['call'] = self.cardGame.highestCall
            response['playerId'] = self.cardGame.highestCaller.id
            handler.sendMessage(response)
        else:
            player = self.cardGame.getPlayerById(request['playerId'])
            if player == self.cardGame.players[self.cardGame.callTurn]:
                response = {'response': 'askCall', 'minCall': self.cardGame.minCall}
                handler.sendMessage(response)

    def makeCall(self, handler, request):
        response = {'response': 'callMade'}
        player = self.cardGame.getPlayerById(request['playerId'])
        if player == self.cardGame.players[self.cardGame.callTurn]:
            response['id'] = player.id
            callValue = int(request['call'])
            # if passed
            if callValue == 0:
                self.cardGame.numberOfPasses += 1
                response['call'] = 'pass'
                if self.cardGame.firstCall == True:
                    self.cardGame.callTurn = (self.cardGame.stayTurn + 1) % 4
                    self.cardGame.stayTurn = self.cardGame.callTurn
                else:
                    if self.cardGame.callStatus == 'stay':
                        self.cardGame.callTurn = (self.cardGame.stayTurn + 1) % 4
                        self.cardGame.minCall += 1
                        self.cardGame.callStatus = 'challenge'
                    elif self.cardGame.callStatus == 'challenge':
                        self.cardGame.callTurn = (self.cardGame.callTurn + 1) % 4
            # if not passed
            elif callValue >= self.cardGame.minCall:
                response['call'] = request['call']
                self.cardGame.highestCall = callValue
                self.cardGame.highestCaller = player
                # first call
                if self.cardGame.firstCall == True:
                    self.cardGame.minCall = callValue + 1
                    self.cardGame.stayTurn = self.cardGame.callTurn
                    self.cardGame.callTurn = (self.cardGame.callTurn + 1) % 4
                    self.cardGame.firstCall = False
                    self.cardGame.callStatus = 'challenge'
                else:
                    if self.cardGame.callStatus == 'stay':
                        self.cardGame.minCall = callValue + 1
                        self.cardGame.callTurn, self.cardGame.stayTurn = self.cardGame.stayTurn, self.cardGame.callTurn
                        self.cardGame.callStatus = 'challenge'
                    elif self.cardGame.callStatus == 'challenge':
                        self.cardGame.minCall = callValue
                        self.cardGame.callTurn, self.cardGame.stayTurn = self.cardGame.stayTurn, self.cardGame.callTurn
                        self.cardGame.callStatus = 'stay'
            if self.cardGame.callTurn == 0 and self.cardGame.callStatus == 'challenge':
                self.cardGame.callWon = True
            self.broadcast(response)

    def nextGame(self, req):
        jsonResponse = {'response': 'nextGame'}
        try:
            jsonResponse['resultCode'] = 'SUCCESS'

            self.cardGame.clearGame()
            self.scores.clearTeamScores()

        except Exception as ex:
            self.writer.sendError(ex)
            raise

        self.writer.sendMessage(jsonResponse)

    

    def chooseTrump(self, handler, request):
        response = {'response': 'trumpChosen'}
        if self.cardGame.getPlayerById(request['playerId']) != self.cardGame.highestCaller:
            return
        try:
            trumpSuit = request['suit']
            self.cardGame.chooseTrump(trumpSuit)
            self.cardGame.dealCards()
            self.hand = HandInfo()
            self.broadcast(response)
        except Exception as ex:
            raise

    def dealAllCards(self, handler, request):
        response = {'response': 'allCards'}
        player = self.cardGame.getPlayerById(request['playerId'])
        allCards = player.getCards()
        logging.debug("Total nr of cards: %s", len(allCards))
        response['cards'] = [{'rank': card.rank, 'suit': card.suit}
                            for card in allCards]
        handler.sendMessage(response)

    def askPlayers(self, handler):
        jsonResponse = {'response': 'handPlayed'}
        trumpSuit = self.cardGame.trumpSuit

        while not self.hand.isComplete():
            player = self.cardGame.getNextPlayer(self.hand.getStep())

            logging.debug("Asking player %s for move", player.name)

            # asynchronous via websocket
            if isinstance(player, HumanPlayer):
                message = {}
                message['response'] = 'askMove'
                message['hand'] = self.hand
                handler.sendMessage(message)
                break
            else:
                card = player.getNextMove(self.hand, trumpSuit)
                self.hand.addPlayerMove(PlayerMove(player, card))
                logging.debug("%s played %s", player.name, card)

        if self.hand.isComplete():
            winningMove = self.hand.decideWinner(trumpSuit)
            pointsWon = self.hand.getHandPoints()
            winningPlayer = winningMove.getPlayer()
            self.readyQueue = []

            logging.debug("Winner is %s\n", winningPlayer)

            self.scores.registerWin(winningPlayer, pointsWon)
            scores = self.scores.getScores()

            self.cardGame.changePlayingOrder(winningPlayer)

            jsonResponse['hand'] = self.hand
            jsonResponse['winningCard'] = winningMove.card
            jsonResponse['winningPlayerId'] = winningPlayer.id
            jsonResponse['scores'] = scores
            self.writer.sendMessage(jsonResponse)

    def isReady(self, handler, request):
        if self.hand.isComplete() == False:
            player = self.cardGame.getNextPlayer(self.hand.getStep())
            if player.id == request['playerId']:
                message = {}
                message['response'] = 'askMove'
                handler.sendMessage(message)
        else:
            winningMove = self.hand.decideWinner(self.cardGame.trumpSuit)
            pointsWon = self.hand.getHandPoints()
            winningPlayer = winningMove.getPlayer()
            self.hand = HandInfo()

            logging.debug("Winner is %s\n", winningPlayer)

            self.scores.registerWin(winningPlayer, pointsWon)
            scores = self.scores.getScores()

            self.cardGame.changePlayingOrder(winningPlayer)

            message = {'response' : 'handPlayed'}
            message['winningCard'] = winningMove.card
            message['winningPlayerId'] = winningPlayer.id
            message['scores'] = scores
            self.broadcast(message)

    def makeMove(self, handler, req):
        try:
            player = self.cardGame.getPlayerById(req['playerId'])
            playedCard = Card(req['suit'], req['rank'])

            playerMove = PlayerMove(player, playedCard)
            validMove = self.hand.validatePlayerMove(playerMove, self.cardGame.trumpSuit)
            if not validMove:
                response = {'response': 'invalidMove', 'playerId': req['playerId']}
                handler.sendMessage(response)
            else:
                self.hand.addPlayerMove(playerMove)
                player.removeCard(playedCard)
                message = {}
                message['response'] = 'moveMade'
                message['hand'] = self.hand
                message['id'] = player.id
                self.broadcast(message)

        except Exception as ex:
            self.writer.sendError(ex)
            raise

    def isReady_old(self, handler, req):
        self.readyQueue.append(handler)
        if len(self.readyQueue) >= 4:
            self.isReady_all()

    def broadcast(self, message):
        for handler in self.handlerQueue:
            handler.sendMessage(message)

    def isReady_all(self):
        try:
            if self.scores.isGameDecided():
                scores = self.scores.getScores()
                winningTeam = self.scores.getWinningTeam()
                self.cardGame.processWin(winningTeam)
                response = {'response': 'gameDecided', 'scores': scores,
                            'winningTeam': winningTeam}
                self.broadcast(response)
            else:
                self.hand = HandInfo()

        except Exception as ex:
            #self.writer.sendError(ex)
            raise

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("template/index.html")

class AboutHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("template/about.html")

class ContactHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("template/contact.html")

class MessageHandler(tornado.websocket.WebSocketHandler):

    def open(self):
        logging.info("Websocket opened")

        self.writer = MessageWriter(self)

    def sendMessage(self, message):
        self.writer.sendMessage(message)

    def on_message(self, message):
        global gameServer
        req = tornado.escape.json_decode(message)
        logging.debug("Message received: %s", req)
        methodName = req['command']
        if hasattr(gameServer, methodName):
            getattr(gameServer, methodName)(self, req)
        else:
            logging.error("Received unknown command [%s]", methodName)

    def on_close(self):
        logging.info("Websocket closed")
        self.gameServer = None

gameServer = None

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG, 
                        format='%(asctime)s %(levelname)s %(message)s')

    gameServer = GameServer()

    handlers = [ (r"/websocket", MessageHandler) ]

    application = tornado.web.Application(handlers, debug=True)
    logging.info("Server started")

    application.listen(8080)
    tornado.ioloop.IOLoop.instance().start()

