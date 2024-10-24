import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WalletContext } from '../context/WalletContext';
import toast from 'react-hot-toast';
import axios from '../api/axios';
import { ethers } from 'ethers';
import Web3 from 'web3';
import ABI  from '../utils/QuizApp.json';
import { Button, CircularProgress, Typography, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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
      console.log("Quiz Index", plusOneIndex)
      const score = response.data.score; // Keep it as is
      console.log("Score", score)
      // const scoreInWei = ethers.utils.parseUnits(score.toString(), 18);
  
      // Check if the window.ethereum is available (MetaMask or another Ethereum provider)
      if (typeof window.ethereum !== 'undefined') {
        // Request access to the user's MetaMask wallet
        // await window.ethereum.request({ method: 'eth_requestAccounts' });
  
        const provider = new ethers.providers.Web3Provider(window.ethereum); // Create a provider
        const signer = provider.getSigner(); // Get the signer (user wallet)
        console.log("Signer", signer)
  
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
      console.log(err)
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
      <div className="flex justify-center items-center bg-violet" style={{ height: 'calc(100vh - 5rem)' }}>
        <CircularProgress sx={{color: 'white'}} />
      </div>
    )
  }



  if (quizEnded) {
    return (
      <div className="flex justify-center items-center bg-violet" style={{ height: 'calc(100vh - 5rem)' }}>
        <Typography variant="h4" className="text-white font-bold">
          The Quiz has Ended
        </Typography>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="flex flex-col justify-center items-center bg-violet gap-[1rem]" style={{ height: 'calc(100vh - 5rem)' }}>
        <Typography variant="h4" className="text-white font-bold">
          Quiz hasn't started yet
        </Typography>
        <Button onClick={() => window.location.reload()} sx={{
          backgroundColor: '#333333',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
        }}>
          Refresh
        </Button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="flex justify-center items-center bg-violet" style={{ height: 'calc(100vh - 5rem)' }}>
      <Dialog open={nameDialogOpen} onClose={() => {}}>
        <DialogTitle>Enter Your Name</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please enter your name to start the quiz.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNameSubmit} color="primary">
            Start Quiz
          </Button>
        </DialogActions>
      </Dialog>
      <div className="relative p-6 h-4/5 w-4/5 max-h-3xl max-w-4xl flex flex-col bg-indigo gap-[0.5rem] rounded-lg shadow-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full"
          >
            <div className="flex flex-row items-center justify-between mb-4">
              <Typography variant="h5" className="text-xl text-white font-bold">
                {currentQuestion.question}
              </Typography>
              <Button
                variant="contained"
                onClick={handleNextQuestion}
                disabled={!answers[currentQuestion._id]}
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  backgroundColor: answers[currentQuestion._id] ? '#6b46c1' : 'white',
                  color: answers[currentQuestion._id] ? 'white' : 'black',
                  '&:hover': {
                    backgroundColor: answers[currentQuestion._id] ? 'gray' : 'white',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'white',
                    color: 'black',
                  },
                }}
              >
                {currentQuestionIndex < quiz.questions.length - 1 ? 'Next' : 'Submit'}
              </Button>
            </div>
            <div className="flex flex-col items-end justify-between mb-4">
              <Typography variant="h6" className="text-lg text-white font-bold max-w-fit">
                Time Left: {timer}s
              </Typography>
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${(timer / 30) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
                className="h-2 bg-purple-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 h-full">
              {Object.entries(currentQuestion.options).map(([key, value], index) => (
                <div
                  key={key}
                  className={`relative flex justify-center items-center rounded-lg text-black font-bold text-lg cursor-pointer transition-transform transform hover:scale-105 p-4 option-box-${index} ${answers[currentQuestion._id] === key ? 'border-2 border-white' : ''}`}
                  onClick={() => handleAnswerChange(currentQuestion._id, key)}
                >
                  {value}
                  {answers[currentQuestion._id] === key && (
                    <CheckCircleIcon
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: '2rem',
                        color: '#9333ea',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;