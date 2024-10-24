import React, { useState, useContext, useRef, useEffect } from 'react';
import { WalletContext } from '../context/WalletContext';
import toast from 'react-hot-toast';
import axios from '../api/axios';
import { ethers } from 'ethers';
import Web3 from 'web3';
import ABI from '../utils/QuizApp.json';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogActions, Button, IconButton, TextField, InputAdornment, CircularProgress } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const PromptToQuiz = () => {
  const { walletAddress } = useContext(WalletContext);
  const [formData, setFormData] = useState({
    creatorName: '',
    prompt: '',
    numParticipants: '',
    questionCount: '',
    rewardPerScore: ''
  });
  const [quizId, setQuizId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [startDisabled, setStartDisabled] = useState(false);
  const [closeDisabled, setCloseDisabled] = useState(true);
  const qrRef = useRef();
  const [quizIds, setQuizIds] = useState([]);
  const [quizQids, setQuizQids] = useState([]);
  
  const CONTRACT_ADDRESS = '0x204533Dd6e6E53fb823f83E079018aB482779C93'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Ensure wallet is connected
    if (!walletAddress) {
      toast.error('Please connect the wallet');
      return;
    }
  
    const { creatorName, prompt, numParticipants, questionCount, rewardPerScore } = formData;
  
    // Validate form data
    if (!creatorName || !prompt || !numParticipants || !questionCount || !rewardPerScore) {
      toast.error('All fields are required');
      return;
    }
    if (questionCount > 30) {
      toast.error('Question count cannot be more than 30');
      return;
    }
  
    // Handle decimal for rewardPerScore
    const rewardPerScoreInWei = ethers.utils.parseUnits(rewardPerScore.toString(), 18);
  
    // Calculate the total cost with decimals handled
    const totalCost = rewardPerScoreInWei.mul(numParticipants).mul(questionCount).mul(ethers.BigNumber.from('110')).div(ethers.BigNumber.from('100'));
  
    try {
      // Submit data to the API first
      const dataToSubmit = {
        creatorName,
        prompt,
        numParticipants,
        questionCount,
        rewardPerScore: rewardPerScoreInWei.toString(), // Save it as a string to avoid precision loss
        creatorWallet: walletAddress,
        totalCost: totalCost.toString()
      };
  
      setLoading(true);
  
      const response = await axios.post(`/api/quiz/create/prompt`, dataToSubmit, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      // Set quiz ID from API response
      const quizId = response.data.quizId;
      setQuizId(quizId);
  
      // Now handle the transaction with the smart contract
      if (typeof window.ethereum !== 'undefined') {
        // Create a provider and signer
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
  
        // Initialize the contract with ABI
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);
  
        // Convert totalCost to wei (smallest unit of Ether)
        const budget = ethers.BigNumber.from(totalCost.toString());
  
        // Call the smart contract to create the quiz
        const tx = await contract.createQuiz(
          quizId,              // Use the quizId received from the API
          questionCount,
          rewardPerScoreInWei,  // Send the rewardPerScore in wei
          { value: budget }     // Send the total cost with the transaction
        );
  
        await tx.wait(); // Wait for the transaction to be mined
        toast.success('Quiz successfully created');
        loadAllQuizzes();
  
        // Reset form data after successful creation
        setFormData({
          creatorName: '',
          prompt: '',
          numParticipants: '',
          questionCount: '',
          rewardPerScore: ''
        });
  
        // Optionally, open modal or perform any other action
        setLoading(false);
        setOpen(true);
      } else {
        toast.error('MetaMask not found. Please install MetaMask.');
      }
    } catch (error) {
      console.error(error.response?.data?.message || 'An error occurred while creating the quiz');
      toast.error(error.response?.data?.message || 'An error occurred while creating the quiz');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setOpen(false);
  };  

  const handleDownload = () => {
    const svg = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `quiz-${quizId}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${baseUrl}/quiz/${quizId}`);
    toast.success('Link copied to clipboard');
  };

  const handleStartQuiz = async () => {
    try {
      await axios.put(`/api/quiz/update/${quizId}`, { isPublic: true });
      setIsPublic(true);
      toast.success('Quiz has started');
    } catch (error) {
      toast.error('Failed to start the quiz');
    }
  };

  const handleStopQuiz = async () => {
    setStartDisabled(true);
    try {
      // Update the quiz status in the API
      await axios.put(`/api/quiz/update/${quizId}`, { isPublic: false, isFinished: true });
      setIsPublic(false);
      setCloseDisabled(false);
  
      if (typeof window.ethereum !== 'undefined') {
        // Create a provider and signer
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        console.log("Signer", signer);
  
        // Initialize the contract with ABI
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);
  
        // Find the index of the quizId in the quizQids array
        const quizIndex = quizQids.indexOf(quizId);
        if (quizIndex === -1) {
          throw new Error('Quiz not found in quizQids array');
        }
        const plusoneindex = quizIndex + 1; // Adjust index if necessary for your contract logic
  
        console.log("Quiz Index", plusoneindex);
  
        // Call the smart contract to end the quiz
        const tx = await contract.endQuiz(plusoneindex);
  
        await tx.wait(); // Wait for the transaction to be mined
        toast.success('Quiz has ended');
        setOpen(false);
      } else {
        toast.error("MetaMask not found. Please install MetaMask.");
      }
    } catch (error) {
      console.error("Error stopping quiz:", error);
      if (error.code === -32000) {
        toast.error('Transaction failed: ' + error.data.message); // Show the revert reason if available
      } else {
        toast.error('Failed to end the quiz');
      }
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
  
  const fetchParticipants = async () => {
    try {
      const response = await axios.get(`/api/quiz/leaderboards/${quizId}`);
      setParticipants(response.data.participants || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  useEffect(() => {
    if (quizId) {
      fetchParticipants();
      const interval = setInterval(fetchParticipants, 1000);
      return () => clearInterval(interval);
    }
    loadAllQuizzes();
    console.log("Wallet Address ",walletAddress);
  }, [quizId]);

  const baseUrl = import.meta.env.VITE_CLIENT_URI;

  return (
    <section
    className="mt-[-5rem] w-full flex items-center justify-center"
    style={{ height: 'calc(100vh - 5rem)' }}
    >
      <span className='flex flex-col gap-[1rem]'>
      <h2 className='text-[3.125rem] text-center font-semibold text-white'>Prompt To Quiz</h2>

        <form
          onSubmit={handleSubmit}
          className="m-auto p-[1.5rem] flex flex-col items-center justify-center bg-purple-800 gap-[0.75rem] w-[45rem] rounded-lg shadow-2xl"
        >
          <input
            type="text"
            name="creatorName"
            placeholder="Creator Name"
            value={formData.creatorName}
            onChange={handleChange}
            className="px-[1rem] py-[1.5rem] text-[1.1rem] text-white placeholder-white focus:outline-none w-full rounded-md"
            required
            style={{
              backgroundColor: '#9333ea',
              boxShadow: 'inset 10px 10px 20px #3b145e, inset -10px -10px 20px #eb52ff'
            }}
            autoComplete='off'
          />
        <div className='grid grid-cols-3 gap-[0.5rem]'>

          <input
            type="number"
            name="numParticipants"
            placeholder="No. of Participants"
            value={formData.numParticipants}
            onChange={handleChange}
            className="px-[1rem] py-[1.5rem] text-[1.1rem] text-white placeholder-white focus:outline-none w-full rounded-md"
            required
            min="1"
            style={{
              backgroundColor: '#9333ea',
              boxShadow: 'inset 10px 10px 20px #3b145e, inset -10px -10px 20px #eb52ff'
            }}
            autoComplete='off'
          />
          <input
            type="number"
            name="questionCount"
            placeholder="No. of Questions"
            value={formData.questionCount}
            onChange={handleChange}
            className="px-[1rem] py-[1.5rem] text-[1.1rem] text-white placeholder-white focus:outline-none w-full rounded-md"
            required
            min="1"
            max="30"
            style={{
              backgroundColor: '#9333ea',
              boxShadow: 'inset 10px 10px 20px #3b145e, inset -10px -10px 20px #eb52ff'
            }}
            autoComplete='off'
          />
          <input
            type="number"
            name="rewardPerScore"
            placeholder="Reward Per Score"
            value={formData.rewardPerScore}
            onChange={handleChange}
            className="px-[1rem] py-[1.5rem] text-[1.1rem] text-white placeholder-white focus:outline-none w-full rounded-md"
            required
            // min="0.01"
            style={{
              backgroundColor: '#9333ea',
              boxShadow: 'inset 10px 10px 20px #3b145e, inset -10px -10px 20px #eb52ff'
            }}
            autoComplete='off'
          />
          </div>
          <textarea
            name="prompt"
            placeholder="Topic of Quiz"
            value={formData.prompt}
            onChange={handleChange}
            className="px-[1rem] py-[1rem] text-[1.1rem] text-white placeholder-white focus:outline-none w-full rounded-md"
            required
            style={{
              backgroundColor: '#9333ea',
              boxShadow: 'inset 10px 10px 20px #3b145e, inset -10px -10px 20px #eb52ff'
            }}
            autoComplete='off'
          />
          <button
            type="submit"
            className="px-[0.5rem] py-[1.25rem] text-[1.1rem] text-white bg-matte-dark hover:bg-matte-light w-full rounded-md flex items-center justify-center"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Quiz'}
          </button>
        </form>
        <Dialog open={open} onClose={(_, reason) => reason === 'backdropClick' ? null : handleClose} maxWidth="md" fullWidth >
          <DialogContent>
            <div className="flex flex-row gap-[2rem]">
              <div className="flex flex-col items-center justify-center gap-[1rem]" ref={qrRef} style={{ flex: 1 }}>
                <h2 className="text-[1.25rem] text-center text-black">Quiz ID: <span className='text-[1.5rem] text-violet font-bold'>{quizId}</span></h2>
                <QRCodeSVG value={`${baseUrl}/quiz/${quizId}`} size={256}                />
                <TextField
                  label="Quiz Link"
                  value={`${baseUrl}/quiz/${quizId}`}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleCopy}>
                          <ContentCopyIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  fullWidth
                />
                <DialogActions>
                  <IconButton onClick={handleDownload} sx={{
                    color: '#6b46c1'
                  }}>
                    <FileDownloadIcon />
                  </IconButton>
                  <Button onClick={handleClose} sx={{
                    color: '#6b46c1'
                  }} disabled={closeDisabled}>
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleStartQuiz}
                    disabled={isPublic || loading || startDisabled}
                    sx={{
                      backgroundColor: '#6b46c1',
                    }}
                  >
                    Start Quiz
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleStopQuiz}
                    disabled={!isPublic || loading}
                    sx={{
                      backgroundColor: '#6b46c1',
                    }}
                  >
                    Stop Quiz
                  </Button>
                </DialogActions>
              </div>
              <div className="flex flex-col items-center justify-center gap-[1rem]" style={{ flex: 1 }}>
                <h2 className="text-[1.25rem] text-center text-black">Participants</h2>
                <ul className="h-full w-full px-[1rem] flex flex-col gap-[0.5rem]" style={{ overflowY: 'scroll', scrollbarWidth: 'thin' }}>
                  {participants.map((participant) => (
                    <li key={participant.walletAddress} className="text-[1rem] text-black border border-transparent border-b-gray-300 flex flex-row items-center justify-between">
                      <span>
                        {participant.participantName}
                      </span>
                      <span>
                        {participant.score !== null ? participant.score : 'N/A'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </span>
    </section>
  );
}

export default PromptToQuiz;