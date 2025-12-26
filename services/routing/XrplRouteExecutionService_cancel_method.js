  /**
   * Create Xaman payload to cancel an open offer
   * @param {string} walletAddress - User's XRPL wallet address
   * @param {number} offerSequence - Sequence number of the offer to cancel
   * @returns {Object} Xaman payload details
   */
  async createOfferCancelPayload(walletAddress, offerSequence) {
    console.log('[XRPL Execution] Creating OfferCancel payload');

    try {
      // Connect to XRPL
      const client = new xrpl.Client(this.rpcUrl);
      await client.connect();

      // Build OfferCancel transaction
      const txJson = {
        TransactionType: 'OfferCancel',
        Account: walletAddress,
        OfferSequence: offerSequence,
        Fee: '12' // 12 drops = 0.000012 XRP
      };

      // Auto-fill transaction fields
      const prepared = await client.autofill(txJson);
      client.disconnect();

      console.log('[XRPL Execution] Prepared OfferCancel transaction:', prepared);

      // Create Xaman signing payload
      const payload = await this.xumm.payload.create({
        txjson: prepared,
        options: {
          submit: true, // Auto-submit after signing
          expire: 5,
          return_url: {
            web: `${process.env.FRONTEND_URL || 'https://dbx-frontend.onrender.com'}/exchange?network=XRP`
          }
        }
      }, true);

      console.log('[XRPL Execution] OfferCancel Xaman payload created:', {
        uuid: payload.uuid,
        qrUrl: payload.refs.qr_png,
        deepLink: payload.next.always
      });

      return {
        success: true,
        payloadId: payload.uuid,
        qrCode: payload.refs.qr_png,
        deepLink: payload.next.always,
        websocket: payload.refs.websocket_status
      };

    } catch (error) {
      console.error('[XRPL Execution] Failed to create OfferCancel payload:', error);
      throw new Error(`Failed to create OfferCancel payload: ${error.message}`);
    }
  }
