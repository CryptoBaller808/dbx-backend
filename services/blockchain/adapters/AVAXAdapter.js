const { BlockchainAdapter, BlockchainError, ErrorCodes } = require('../blockchain-abstraction-layer');
const { ethers } = require('ethers');

/**
 * Avalanche (AVAX) Blockchain Adapter
 * Supports Avalanche C-Chain (EVM-compatible)
 */
class AVAXAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.provider = null;
    this.chainId = 'AVALANCHE';
    this.networkConfig = {
      mainnet: {
        chainId: 43114,
        name: 'Avalanche Mainnet C-Chain',
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
        explorerUrl: 'https://snowtrace.io',
        nativeCurrency: {
          name: 'Avalanche',
          symbol: 'AVAX',
          decimals: 18
        }
      },
      testnet: {
        chainId: 43113,
        name: 'Avalanche Fuji Testnet',
        rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
        explorerUrl: 'https://testnet.snowtrace.io',
        nativeCurrency: {
          name: 'Avalanche',
          symbol: 'AVAX',
          decimals: 18
        }
      }
    };
  }

  /**
   * Initialize the AVAX adapter
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
      console.log(`[AVAX Adapter] Initialized for ${network}`);
      
      return {
        success: true,
        chainId: this.chainId,
        network: networkConfig.name,
        blockNumber: await this.provider.getBlockNumber()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize AVAX adapter: ${error.message}`,
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
        // ERC-20 token balance
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
        // Native AVAX balance
        balance = await this.provider.getBalance(address);
        decimals = 18;
        symbol = 'AVAX';
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
        maxFeePerGas: tx.maxFeePerGas ? ethers.formatUnits(tx.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.formatUnits(tx.maxPriorityFeePerGas, 'gwei') : null,
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
        maxFeePerGas,
        maxPriorityFeePerGas,
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

      // Build transaction object
      const tx = {
        from,
        to,
        value: ethers.parseEther(value.toString()),
        data,
        nonce: currentNonce,
        chainId: Number(network.chainId)
      };

      // Handle gas pricing (EIP-1559 vs legacy)
      if (maxFeePerGas && maxPriorityFeePerGas) {
        // EIP-1559 transaction
        tx.maxFeePerGas = ethers.parseUnits(maxFeePerGas.toString(), 'gwei');
        tx.maxPriorityFeePerGas = ethers.parseUnits(maxPriorityFeePerGas.toString(), 'gwei');
        tx.type = 2;
      } else if (gasPrice) {
        // Legacy transaction
        tx.gasPrice = ethers.parseUnits(gasPrice.toString(), 'gwei');
        tx.type = 0;
      } else {
        // Auto-detect gas pricing
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          tx.maxFeePerGas = feeData.maxFeePerGas;
          tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
          tx.type = 2;
        } else {
          tx.gasPrice = feeData.gasPrice;
          tx.type = 0;
        }
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

          // Switch to Avalanche network if needed
          await this.switchToAvalancheNetwork();

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
        maxFeePerGas: gasPrice.maxFeePerGas ? ethers.formatUnits(gasPrice.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas ? 
          ethers.formatUnits(gasPrice.maxPriorityFeePerGas, 'gwei') : null,
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
   * Switch to Avalanche network in MetaMask
   */
  async switchToAvalancheNetwork() {
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
      if (tx.maxFeePerGas) {
        fee = tx.gasLimit * tx.maxFeePerGas;
      } else if (tx.gasPrice) {
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
    // This would integrate with Avalanche DEXs like Trader Joe, Pangolin
    throw new BlockchainError(
      'Swap functionality not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      this.chainId
    );
  }
}

module.exports = AVAXAdapter;

