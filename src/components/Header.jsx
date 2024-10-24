import { Link } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { WalletContext } from '../context/WalletContext';
import Logo from '../assets/logo.png';

const Header = () => {
  const { walletAddress, connectWallet, network, switchNetwork } = useContext(WalletContext);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    if (network === 'AIA') {
      setIsCorrectNetwork(true); 
    } else {
      setIsCorrectNetwork(false);
    }
  }, [network]); 

  return (
    <nav className='px-[5rem] h-[5rem] flex flex-row items-center justify-between text-white bg-indigo'>
      <Link to={'/'} className='flex flex-row items-center justify-center gap-[0.25rem] cursor-pointer'>
        <img src={Logo} alt="Vibe Logo" className='h-auto w-full max-w-[3.5rem] object-cover' />
        <h1 className='text-[2.25rem] font-bold'>Vibe</h1>
      </Link>

      <div>
        {walletAddress ? (
          
          !isCorrectNetwork ? (
            <button
              onClick={switchNetwork}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
            >
              Switch to AIA
            </button>
          ) : (
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
              Connected: {truncateAddress(walletAddress)}
            </button>
          )
        ) : (
          <button
            onClick={connectWallet}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Connect Wallet
          </button>
        )}
      </div>

    </nav>
  );
};

export default Header;
