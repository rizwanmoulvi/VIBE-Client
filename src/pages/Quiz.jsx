import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WalletContext } from '../context/WalletContext';
import toast from 'react-hot-toast';
import axios from '../api/axios';
import { ethers } from 'ethers';
import ABI  from '../utils/QuizApp.json';
import { Dialog, DialogContent, } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, ArrowRight, CheckCircle2, RefreshCcw, Trophy, Loader2 } from 'lucide-react';

const Quiz = () => {
  const { id } = useParams();
  const { walletAddress, connectWallet } = useContext(WalletContext);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [participantName, setParticipantName] = useState('');
  const [nameDialogOpen, setNameDialogOpen] = useState(true);
  const [timer, setTimer] = useState(30);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizEnded, setQuizEnded] = useState(false);
  const navigate = useNavigate();
  const [quizIds, setQuizIds] = useState([]);
  const [quizQids, setQuizQids] = useState([]);
  const [error, setError] = useState('');

  const CONTRACT_ADDRESS = '0x204533Dd6e6E53fb823f83E079018aB482779C93'

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!walletAddress) {
        toast.error('Please connect your wallet first.');
        await connectWallet();
        return;
      }

      try {
        const response = await axios.post(`/api/quiz/verify/${id}`, { walletAddress }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        setQuiz(response.data);
        console.log("Quiz", response.data)
        setQuizStarted(response.data.isPublic);
        setQuizEnded(response.data.isFinished);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error);
        console.log(err)
        toast.error(err.response?.data?.error || 'An error occurred while fetching the quiz.');
        setLoading(false);
      }
    };

    fetchQuiz();
    loadAllQuizzes(); // Ensure loadAllQuizzes is awaited

  }, [id, walletAddress, connectWallet]);

  useEffect(() => {
    let interval;
    if (quizStarted) {
      interval = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            handleNextQuestion();
            return 30;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [quizStarted, currentQuestionIndex]);

  const handleAnswerChange = (questionId, answer) => {
    setAnswers({
      ...answers,
      [questionId]: answer
    });
  };

  const handleNextQuestion = () => {
    const currentQuestion = quiz.questions[currentQuestionIndex];
    if (!answers[currentQuestion._id]) {
      setAnswers({
        ...answers,
        [currentQuestion._id]: 'no_answer'
      });
    }
    setTimer(30);
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handleJoinQuiz = async () => {
    try {
      const response = await axios.post(`/api/quiz/join/${id}`, {
        walletAddress,
        participantName
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      toast.success('Joined quiz successfully!');
      setNameDialogOpen(false);
      setQuizStarted(true); // Start the quiz and timer
    } catch (err) {
      console.log(err)
      toast.error(err.response?.data?.error || 'An error occurred while joining the quiz.');
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      // Submit the quiz answers to the API first
      const response = await axios.post('/api/quiz/submit', {
        quizId: id,
        walletAddress,
        answers
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      // Assuming that the response contains the quizId and score
      const qid = response.data.quizId;
      const quizIndex = quizQids.indexOf(qid);
      const plusOneIndex = quizIndex + 1;
      const score = response.data.score;
  
      // Check if the score is greater than 0
      if (score <= 0) {
        toast.error('Score must be greater than 0 to submit.');
        return;
      }
  
      // Check if the window.ethereum is available (MetaMask or another Ethereum provider)
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum); // Create a provider
        const signer = provider.getSigner(); // Get the signer (user wallet)
  
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer); // Initialize the contract
  
        // Send the transaction to the smart contract to submit the quiz score
        const tx = await contract.joinQuiz(
          plusOneIndex, // The quiz index
          score       // The score obtained from the API
        );
  
        // Wait for the transaction to be mined
        await tx.wait();
  
        toast.success('Quiz score submitted successfully to the smart contract!');
      } else {
        toast.error('MetaMask not found. Please install MetaMask.');
      }
  
      // Navigate to leaderboards after successful submissions
      navigate(`/leaderboards/${id}`);
    } catch (err) {
      // Handle errors from either API or smart contract interaction
      toast.error(err.response?.data?.error || 'An error occurred while submitting the quiz.');
      console.log(err);
    }
  };
  
  const loadAllQuizzes = async () => {
    try {
      const { ethereum } = window;
  
      if (!ethereum) {
        toast.error('MetaMask not found. Please install MetaMask.');
        console.error('MetaMask not available. Make sure the MetaMask extension is installed.');
        return;
      }
  
      console.log('Requesting MetaMask account access...');
      await ethereum.request({ method: 'eth_requestAccounts' });
  
      console.log('Wallet Address', await ethereum.selectedAddress);
  
      // Debugging: Check if ethers is defined
      console.log('Ethers object:', ethers); // This should not be undefined
  
      if (!ethers || !ethers.providers) {
        console.error('Ethers.js is not properly imported or initialized.');
        toast.error('Ethers.js library is missing or not initialized.');
        return;
      }
  
      // Initialize provider and signer
      console.log('Initializing provider and signer...');
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();
      console.log("Signer", signer)
      
      console.log('Provider and signer initialized:', provider, signer);
  
      // Create contract instance
      console.log('Creating contract instance...');
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        ABI.abi,
        signer
      );
  
      // Fetch the quizzes
      console.log('Fetching quizzes from the contract...');
      const result = await contract.getAllQuizzes();
  
      console.log('Quizzes fetched successfully:', result);
      setQuizIds(result[0]);
      setQuizQids(result[1]);
  
    } catch (error) {
      console.error('Error loading quizzes:', error);
      toast.error('Failed to load quizzes. Check console for details.');
    }
  };

  const handleNameSubmit = () => {
    if (!participantName) {
      toast.error('Please enter your name.');
      return;
    }
    handleJoinQuiz();
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 6rem)' }}>
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (quizEnded) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 6rem)' }}>
        <div className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-purple-400 mx-auto" />
          <h1 className="text-4xl font-bold text-white">Quiz has ended</h1>
          <p className="text-purple-200">Check the leaderboard to see the results</p>
        </div>
      </div>
    );
  }


  if (!quizStarted) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 6rem)' }}>
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-white">
            Quiz hasn't started yet
          </h1>
          <p className="text-purple-200">Please wait for the quiz to begin</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCcw size={20} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="flex items-center justify-center px-4" style={{ height: 'calc(100vh - 6rem)' }}>
      {/* Name Dialog */}
      <Dialog 
        open={nameDialogOpen}
        PaperProps={{
          style: {
            backgroundColor: '#1a103d',
            backgroundImage: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.1), rgba(79, 70, 229, 0.1))',
            borderRadius: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: '400px',
            width: '100%',
          }
        }}
      >
        <DialogContent className="space-y-4">
          <h2 className="text-2xl font-bold text-white text-center">Welcome to the Quiz</h2>
          <p className="text-purple-200 text-center">Please enter your name to begin</p>
          <input
            type="text"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleNameSubmit}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
          >
            Start Quiz
          </button>
        </DialogContent>
      </Dialog>

      {/* Main Quiz Container */}
      <div className="w-full max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl space-y-6"
          >
            {/* Timer and Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-purple-200">
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </span>
                <div className="flex items-center gap-2 text-white">
                  <Timer size={20} className="text-purple-400" />
                  <span className="font-medium">{timer}s</span>
                </div>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timer / 30) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            </div>

            {/* Question */}
            <h2 className="text-2xl font-bold text-white">{currentQuestion.question}</h2>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <motion.button
                  key={key}
                  onClick={() => handleAnswerChange(currentQuestion._id, key)}
                  className={`relative p-6 text-left rounded-xl border transition-all ${
                    answers[currentQuestion._id] === key
                      ? 'bg-purple-500/20 border-purple-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-white font-medium">{value}</span>
                  {answers[currentQuestion._id] === key && (
                    <CheckCircle2 className="absolute top-4 right-4 text-purple-400" size={24} />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-end">
              <button
                onClick={handleNextQuestion}
                disabled={!answers[currentQuestion._id]}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                  answers[currentQuestion._id]
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'Submit Quiz'}
                <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;
