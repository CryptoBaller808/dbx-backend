const { BlockchainAdapter, BlockchainError, ErrorCodes } = require('../blockchain-abstraction-layer');
const { ethers } = require('ethers');

/**
 * Binance Smart Chain (BNB) Blockchain Adapter
 * Supports BSC (EVM-compatible)
 */
class BNBAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.provider = null;
    this.chainId = 'BSC';
    this.networkConfig = {
      mainnet: {
        chainId: 56,
        name: 'Binance Smart Chain Mainnet',
        rpcUrl: 'https://bsc-dataseed1.binance.org',
        explorerUrl: 'https://bscscan.com',
        nativeCurrency: {
          name: 'Binance Coin',
          symbol: 'BNB',
          decimals: 18
        }
      },
      testnet: {
        chainId: 97,
        name: 'Binance Smart Chain Testnet',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        explorerUrl: 'https://testnet.bscscan.com',
        nativeCurrency: {
          name: 'Binance Coin',
          symbol: 'BNB',
          decimals: 18
        }
      }
    };
  }

  /**
   * Initialize the BNB adapter
   */
  async initialize() {
    try {
      const network = this.config.network || 'mainnet';
      const networkConfig = this.networkConfig[network];
      
      if (!networkConfig) {
        throw new BlockchainError(
          `Unsupported network: ${network}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(
        this.config.rpcUrl || networkConfig.rpcUrl,
        {
          chainId: networkConfig.chainId,
          name: networkConfig.name
        }
      );

      // Test connection
      await this.provider.getNetwork();
      
      this.isInitialized = true;
      console.log(`[BNB Adapter] Initialized for ${network}`);
      
      return {
        success: true,
        chainId: this.chainId,
        network: networkConfig.name,
        blockNumber: await this.provider.getBlockNumber()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize BNB adapter: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get balance for an address
   */
  async getBalance(address, tokenAddress = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!ethers.isAddress(address)) {
        throw new BlockchainError(
          'Invalid address format',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      let balance, decimals, symbol;

      if (tokenAddress) {
        // BEP-20 token balance
        if (!ethers.isAddress(tokenAddress)) {
          throw new BlockchainError(
            'Invalid token address format',
            ErrorCodes.INVALID_PARAMS,
            this.chainId
          );
        }

        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)'
          ],
          this.provider
        );

        [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
      } else {
        // Native BNB balance
        balance = await this.provider.getBalance(address);
        decimals = 18;
        symbol = 'BNB';
      }

      const formattedBalance = ethers.formatUnits(balance, decimals);

      return {
        address,
        balance: formattedBalance,
        balanceWei: balance.toString(),
        decimals,
        symbol,
        tokenAddress: tokenAddress || null,
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash).catch(() => null)
      ]);

      if (!tx) {
        throw new BlockchainError(
          'Transaction not found',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        valueWei: tx.value.toString(),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : null,
        nonce: tx.nonce,
        data: tx.data,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        transactionIndex: tx.index,
        confirmations: receipt ? await tx.confirmations() : 0,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        gasUsed: receipt ? receipt.gasUsed.toString() : null,
        effectiveGasPrice: receipt && receipt.effectiveGasPrice ? 
          ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') : null,
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get transaction: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Build a transaction
   */
  async buildTransaction(txParams) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        from,
        to,
        value = '0',
        data = '0x',
        gasLimit,
        gasPrice,
        nonce
      } = txParams;

      // Validate addresses
      if (!ethers.isAddress(from)) {
        throw new BlockchainError(
          'Invalid from address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      if (!ethers.isAddress(to)) {
        throw new BlockchainError(
          'Invalid to address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Get current network info
      const network = await this.provider.getNetwork();
      const currentNonce = nonce !== undefined ? nonce : await this.provider.getTransactionCount(from);

      // Build transaction object (BSC uses legacy gas pricing)
      const tx = {
        from,
        to,
        value: ethers.parseEther(value.toString()),
        data,
        nonce: currentNonce,
        chainId: Number(network.chainId),
        type: 0 // Legacy transaction type for BSC
      };

      // Handle gas pricing (BSC primarily uses legacy gas pricing)
      if (gasPrice) {
        tx.gasPrice = ethers.parseUnits(gasPrice.toString(), 'gwei');
      } else {
        // Auto-detect gas price
        const feeData = await this.provider.getFeeData();
        tx.gasPrice = feeData.gasPrice;
      }

      // Estimate gas limit if not provided
      if (gasLimit) {
        tx.gasLimit = BigInt(gasLimit);
      } else {
        try {
          tx.gasLimit = await this.provider.estimateGas(tx);
        } catch (error) {
          // Use default gas limit if estimation fails
          tx.gasLimit = BigInt(21000);
        }
      }

      return {
        transaction: tx,
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        estimatedGas: tx.gasLimit.toString(),
        estimatedFee: this.calculateTransactionFee(tx)
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to build transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx, signingParams) {
    try {
      const { privateKey, wallet } = signingParams;

      let signer;
      if (privateKey) {
        signer = new ethers.Wallet(privateKey, this.provider);
      } else if (wallet) {
        signer = wallet.connect(this.provider);
      } else {
        throw new BlockchainError(
          'No signing method provided',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      const signedTx = await signer.signTransaction(tx.transaction);

      return {
        signedTransaction: signedTx,
        hash: ethers.keccak256(signedTx),
        chainId: this.chainId,
        from: signer.address
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to sign transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Submit a signed transaction
   */
  async submitTransaction(signedTx) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const txResponse = await this.provider.broadcastTransaction(signedTx.signedTransaction);

      return {
        hash: txResponse.hash,
        from: txResponse.from,
        to: txResponse.to,
        value: ethers.formatEther(txResponse.value),
        gasLimit: txResponse.gasLimit.toString(),
        gasPrice: txResponse.gasPrice ? ethers.formatUnits(txResponse.gasPrice, 'gwei') : null,
        nonce: txResponse.nonce,
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        status: 'pending',
        blockNumber: null,
        confirmations: 0
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to submit transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Connect to wallet (MetaMask/WalletConnect)
   */
  async connectWallet(options = {}) {
    try {
      const { walletType = 'metamask', walletConnectProjectId } = options;

      if (walletType === 'metamask') {
        if (typeof window !== 'undefined' && window.ethereum) {
          const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
          });

          // Switch to BSC network if needed
          await this.switchToBSCNetwork();

          return {
            success: true,
            walletType: 'metamask',
            accounts,
            chainId: this.chainId,
            network: this.config.network || 'mainnet'
          };
        } else {
          throw new BlockchainError(
            'MetaMask not detected',
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }
      } else if (walletType === 'walletconnect') {
        // WalletConnect implementation would go here
        throw new BlockchainError(
          'WalletConnect not implemented yet',
          ErrorCodes.NOT_SUPPORTED,
          this.chainId
        );
      } else {
        throw new BlockchainError(
          `Unsupported wallet type: ${walletType}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to connect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnectWallet() {
    try {
      // For MetaMask, we can't programmatically disconnect
      // The user needs to disconnect from their wallet
      return {
        success: true,
        message: 'Please disconnect from your wallet manually'
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to disconnect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get network status
   */
  async getNetworkStatus() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const [network, blockNumber, gasPrice] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getFeeData()
      ]);

      return {
        chainId: this.chainId,
        networkId: Number(network.chainId),
        networkName: network.name,
        blockNumber,
        gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : null,
        isConnected: true,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Switch to BSC network in MetaMask
   */
  async switchToBSCNetwork() {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    const network = this.config.network || 'mainnet';
    const networkConfig = this.networkConfig[network];

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }]
      });
    } catch (switchError) {
      // Network not added to MetaMask, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${networkConfig.chainId.toString(16)}`,
            chainName: networkConfig.name,
            nativeCurrency: networkConfig.nativeCurrency,
            rpcUrls: [networkConfig.rpcUrl],
            blockExplorerUrls: [networkConfig.explorerUrl]
          }]
        });
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Calculate transaction fee
   */
  calculateTransactionFee(tx) {
    try {
      let fee;
      if (tx.gasPrice) {
        fee = tx.gasLimit * tx.gasPrice;
      } else {
        return '0';
      }
      
      return ethers.formatEther(fee);
    } catch (error) {
      return '0';
    }
  }

  /**
   * Get swap quote (DEX integration)
   */
  async getSwapQuote(tokenA, tokenB, amount) {
    // This would integrate with BSC DEXs like PancakeSwap, Venus
    throw new BlockchainError(
      'Swap functionality not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      this.chainId
    );
  }

  /**
   * Get popular tokens on BSC
   */
  getPopularTokens() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return {
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        ADA: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
        DOT: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
        LINK: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
        CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        XRP: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE'
      };
    } else {
      // BSC testnet tokens
      return {
        USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        USDC: '0x64544969ed7EBf5f083679233325356EbE738930',
        BUSD: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee'
      };
    }
  }

  /**
   * Get PancakeSwap router address
   */
  getPancakeSwapRouter() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap V2 Router
    } else {
      return '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'; // PancakeSwap Testnet Router
    }
  }

  /**
   * Get WBNB address
   */
  getWBNBAddress() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    } else {
      return '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';
    }
  }
}

module.exports = BNBAdapter;

