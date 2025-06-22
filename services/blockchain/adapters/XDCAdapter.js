const { BlockchainAdapter, BlockchainError, ErrorCodes } = require('../blockchain-abstraction-layer');
const { ethers } = require('ethers');

/**
 * XDC Network (XDC) Blockchain Adapter
 * Supports XDC Network (EVM-compatible with XDC addressing)
 */
class XDCAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.provider = null;
    this.chainId = 'XDC';
    this.networkConfig = {
      mainnet: {
        chainId: 50,
        name: 'XDC Network',
        rpcUrl: 'https://rpc.xinfin.network',
        explorerUrl: 'https://explorer.xinfin.network',
        nativeCurrency: {
          name: 'XDC',
          symbol: 'XDC',
          decimals: 18
        }
      },
      testnet: {
        chainId: 51,
        name: 'XDC Apothem Network',
        rpcUrl: 'https://rpc.apothem.network',
        explorerUrl: 'https://explorer.apothem.network',
        nativeCurrency: {
          name: 'XDC',
          symbol: 'XDC',
          decimals: 18
        }
      }
    };
  }

  /**
   * Initialize the XDC adapter
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
      console.log(`[XDC Adapter] Initialized for ${network}`);
      
      return {
        success: true,
        chainId: this.chainId,
        network: networkConfig.name,
        blockNumber: await this.provider.getBlockNumber()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize XDC adapter: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Convert XDC address format (xdc...) to Ethereum format (0x...)
   */
  convertXDCToEthAddress(address) {
    if (typeof address !== 'string') {
      return address;
    }
    
    if (address.toLowerCase().startsWith('xdc')) {
      return '0x' + address.slice(3);
    }
    
    return address;
  }

  /**
   * Convert Ethereum address format (0x...) to XDC format (xdc...)
   */
  convertEthToXDCAddress(address) {
    if (typeof address !== 'string') {
      return address;
    }
    
    if (address.toLowerCase().startsWith('0x')) {
      return 'xdc' + address.slice(2);
    }
    
    return address;
  }

  /**
   * Get balance for an address
   */
  async getBalance(address, tokenAddress = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Convert XDC address format to Ethereum format for internal use
      const ethAddress = this.convertXDCToEthAddress(address);
      
      if (!ethers.isAddress(ethAddress)) {
        throw new BlockchainError(
          'Invalid address format',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      let balance, decimals, symbol;

      if (tokenAddress) {
        // XRC-20 token balance
        const ethTokenAddress = this.convertXDCToEthAddress(tokenAddress);
        
        if (!ethers.isAddress(ethTokenAddress)) {
          throw new BlockchainError(
            'Invalid token address format',
            ErrorCodes.INVALID_PARAMS,
            this.chainId
          );
        }

        const tokenContract = new ethers.Contract(
          ethTokenAddress,
          [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)'
          ],
          this.provider
        );

        [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(ethAddress),
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
      } else {
        // Native XDC balance
        balance = await this.provider.getBalance(ethAddress);
        decimals = 18;
        symbol = 'XDC';
      }

      const formattedBalance = ethers.formatUnits(balance, decimals);

      return {
        address: this.convertEthToXDCAddress(ethAddress), // Return in XDC format
        balance: formattedBalance,
        balanceWei: balance.toString(),
        decimals,
        symbol,
        tokenAddress: tokenAddress ? this.convertEthToXDCAddress(tokenAddress) : null,
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
        from: this.convertEthToXDCAddress(tx.from),
        to: this.convertEthToXDCAddress(tx.to),
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

      // Convert XDC addresses to Ethereum format for internal use
      const ethFrom = this.convertXDCToEthAddress(from);
      const ethTo = this.convertXDCToEthAddress(to);

      // Validate addresses
      if (!ethers.isAddress(ethFrom)) {
        throw new BlockchainError(
          'Invalid from address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      if (!ethers.isAddress(ethTo)) {
        throw new BlockchainError(
          'Invalid to address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Get current network info
      const network = await this.provider.getNetwork();
      const currentNonce = nonce !== undefined ? nonce : await this.provider.getTransactionCount(ethFrom);

      // Build transaction object (XDC uses legacy gas pricing)
      const tx = {
        from: ethFrom,
        to: ethTo,
        value: ethers.parseEther(value.toString()),
        data,
        nonce: currentNonce,
        chainId: Number(network.chainId),
        type: 0 // Legacy transaction type for XDC
      };

      // Handle gas pricing
      if (gasPrice) {
        tx.gasPrice = ethers.parseUnits(gasPrice.toString(), 'gwei');
      } else {
        // Auto-detect gas price
        const feeData = await this.provider.getFeeData();
        tx.gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei'); // Default 1 gwei for XDC
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
        from: this.convertEthToXDCAddress(signer.address)
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
        from: this.convertEthToXDCAddress(txResponse.from),
        to: this.convertEthToXDCAddress(txResponse.to),
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

          // Switch to XDC network if needed
          await this.switchToXDCNetwork();

          // Convert accounts to XDC format
          const xdcAccounts = accounts.map(account => this.convertEthToXDCAddress(account));

          return {
            success: true,
            walletType: 'metamask',
            accounts: xdcAccounts,
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
   * Switch to XDC network in MetaMask
   */
  async switchToXDCNetwork() {
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
    // This would integrate with XDC DEXs
    throw new BlockchainError(
      'Swap functionality not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      this.chainId
    );
  }

  /**
   * Get popular tokens on XDC Network
   */
  getPopularTokens() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return {
        WXDC: 'xdc7d9c3c7e5e8b8e8b8e8b8e8b8e8b8e8b8e8b8e', // Wrapped XDC
        USDT: 'xdc0fd9e8d3af1aaee056eb9e802c3a762b32e4470', // Tether USD
        USDC: 'xdcd4b5784240820d1a0b2e51725b18a4b46c4e1c', // USD Coin
        // Add more XDC tokens as they become available
      };
    } else {
      // XDC testnet tokens
      return {
        WXDC: 'xdc7d9c3c7e5e8b8e8b8e8b8e8b8e8b8e8b8e8b8e',
        USDT: 'xdc0fd9e8d3af1aaee056eb9e802c3a762b32e4470'
      };
    }
  }
}

module.exports = XDCAdapter;

