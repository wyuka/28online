import logging
import uuid

from cards import Deck


class ScoreKeeper:

    def __init__(self, players=None):
        self.teamScore = {}
        self.playerScore = {}
        for player in players:
            self.playerScore[player.name] = 0
            self.teamScore[player.team] = 0

    def registerWin(self, player, points):
        self.teamScore[player.team] = self.teamScore[player.team] + points
        self.playerScore[player.name] = self.playerScore[player.name] + points

    def isGameDecided(self):
        for score in self.teamScore.values():
            if score > 27:
                return True
        return False

    def clearTeamScores(self):
        for team in self.teamScore:
          self.teamScore[team] = 0

    def getWinningTeam(self):
        return max(self.teamScore, key=self.teamScore.get)

    def getScores(self):
        return {"teamScore": self.teamScore, "playerScore": self.playerScore}

class Call:
    def __init__(self, players=None):
        try:
            self.players = players
            self.playerToCall = self.players[1]
            self.playerToStay = self.players[0]
            self.currentCall = 16
            self.currentCaller = self.players[0]
        except:
            pass

class CardGame:

    def __init__(self, players=None):
        self.id = uuid.uuid1()
        self.deck = CardGame.createDeck()
        self.players = players
        self.startingPlayerIndex = 0
        self.state = "INITIALIZED"
        self.trumpSuit = None
        self.playingOrder = []

        # call variables
        self.minCall = 0
        self.callTurn = 0
        self.stayTurn = 0
        self.callStatus = ''
        self.highestCaller = None
        self.highestCall = 0
        self.numberOfPasses = 0
        self.callWon = False
        self.firstCall = False

    @staticmethod
    def createDeck():
        deck = Deck()
        deck.shuffle()
        return deck

    @staticmethod
    def getHighestCard(cards):
        def getHigherCard(card1, card2):
            if card1.rank > card2.rank:
                return card1
            else:
                return card2
        return reduce(getHigherCard, cards)

    def initCall(self):
        self.highestCaller = self.players[0]
        self.highestCall = 16
        self.minCall = 16
        self.stayTurn = 0
        self.callTurn = 0
        self.callStatus = 'stay'
        self.numberOfPasses = 0
        self.callWon = False
        self.firstCall = True

    def getStartingPlayer(self):
        return self.players[self.startingPlayerIndex]

    def getNextPlayer(self, step):
        index = self.playingOrder[step]
        return self.players[index]

    def changePlayingOrder(self, winningPlayer):
        self.startingPlayerIndex = self.players.index(winningPlayer)
        self.setPlayingOrder()

    def decideOrder(self):
        cards = self.deck.sample(len(self.players))

        for i in range(0, len(self.players)):
            logging.debug("%s drew %s", self.players[i], cards[i])

        highestCard = CardGame.getHighestCard(cards)
        self.startingPlayerIndex = cards.index(highestCard)
        logging.debug("Starting player is: %s\n", self.getStartingPlayer())
        self.setPlayingOrder()

        self.state = "ORDER_DECIDED"

    def dealFirstCards(self):
        for player in self.getPlayersInOrder():
            firstCards = self.deck.removeCards(4)
            player.addCards(firstCards)

    def chooseTrump(self, trumpSuit):
        self.trumpSuit = trumpSuit
        logging.debug("Trump is chosen as %s", self.trumpSuit)
        self.state = "TRUMP_CHOSEN"

    def dealCards(self):
        while self.deck.hasNext():
            for player in self.players:
                nextCard = self.deck.removeCard()
                player.addCard(nextCard)

        self.state = "DEALT"

    def getPlayers(self):
        return self.players

    def getPlayerById(self, playerId):
        player = next((p for p in self.players if p.id == playerId), None)
        return player

    def getOrder(self):
        return self.playingOrder

    def setPlayingOrder(self):
        numPlayers = len(self.players)
        self.playingOrder = [(self.startingPlayerIndex + i) % numPlayers
                             for i in range(0, numPlayers)]

    def getPlayersInOrder(self):
        for i in self.getOrder():
            yield self.players[i]

    def processWin(self, winningTeam):
        currentStartingPlayer = self.getStartingPlayer()
        logging.debug("startingPlayerIndex %s", self.startingPlayerIndex)
        logging.debug("startingPlayer name %s", currentStartingPlayer.name)
        logging.debug("startingPlayer team %s", currentStartingPlayer.team)
        logging.debug("winningTeam %s", winningTeam)
        if currentStartingPlayer.team == winningTeam:
          logging.debug("Current starting player is in winning team, not changing playing order")
        else:
          logging.debug("Winning is opposing team, advancing playing order")
          self.advancePlayingOrder()
    
    def advancePlayingOrder(self):
        logging.debug("Before advancing playingOrder: %s", this.playingOrder)
        this.startingPlayerIndex = self.playingOrder[1]
        self.setPlayingOrder()
        logging.debug("After advancing playingOrder: %s", this.playingOrder)
 
    def clearGame(self):
        #self.startingPlayerIndex = 0
        #self.setPlayingOrder()
        self.deck = CardGame.createDeck() 
        for player in self.players:
          player.clearCards()

if __name__ == "__main__":
    game = CardGame()
