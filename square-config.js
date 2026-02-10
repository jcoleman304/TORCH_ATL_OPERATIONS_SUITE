// TORCH ATL - Square Payment Integration
// =======================================

const TorchSquare = {
    // Configuration - UPDATE THESE WITH YOUR CREDENTIALS
    config: {
        applicationId: '', // Your Square Application ID
        accessToken: '',   // Your Square Access Token
        locationId: '',    // Your Square Location ID
        environment: 'sandbox', // 'sandbox' for testing, 'production' for live

        // API Endpoints
        baseUrl: {
            sandbox: 'https://connect.squareupsandbox.com/v2',
            production: 'https://connect.squareup.com/v2'
        }
    },

    // Membership Products - These will be created in Square
    products: {
        residency: {
            name: 'TORCH ATL - Residency Membership',
            price: 500000, // $5,000.00 in cents
            interval: 'MONTHLY',
            hours: 120,
            description: '120 hours/month. Premium tier for anchor members.'
        },
        residencyFounding: {
            name: 'TORCH ATL - Residency Founding',
            price: 425000, // $4,250.00 in cents
            interval: 'MONTHLY',
            hours: 120,
            description: '120 hours/month. Founding rate (15% off).'
        },
        member: {
            name: 'TORCH ATL - Member Membership',
            price: 350000, // $3,500.00 in cents
            interval: 'MONTHLY',
            hours: 64,
            description: '64 hours/month. Standard membership.'
        },
        memberFounding: {
            name: 'TORCH ATL - Member Founding',
            price: 297500, // $2,975.00 in cents
            interval: 'MONTHLY',
            hours: 64,
            description: '64 hours/month. Founding rate (15% off).'
        },
        session: {
            name: 'TORCH ATL - Session Membership',
            price: 220000, // $2,200.00 in cents
            interval: 'MONTHLY',
            hours: 32,
            description: '32 hours/month. Entry level membership.'
        },
        sessionFounding: {
            name: 'TORCH ATL - Session Founding',
            price: 187000, // $1,870.00 in cents
            interval: 'MONTHLY',
            hours: 32,
            description: '32 hours/month. Founding rate (15% off).'
        },
        camp3Day: {
            name: 'TORCH ATL - 3-Day Writing Camp',
            price: 300000, // $3,000.00 in cents
            interval: 'ONE_TIME',
            description: '3-day exclusive facility access for writing camps.'
        },
        camp5Day: {
            name: 'TORCH ATL - 5-Day Writing Camp',
            price: 500000, // $5,000.00 in cents
            interval: 'ONE_TIME',
            description: '5-day exclusive facility access for writing camps.'
        }
    },

    // Initialize Square
    init: function() {
        if (!this.config.accessToken) {
            console.warn('[Square] Access token not configured. Run setup first.');
            return false;
        }
        console.log('[Square] Initialized in', this.config.environment, 'mode');
        return true;
    },

    // Get API URL
    getBaseUrl: function() {
        return this.config.baseUrl[this.config.environment];
    },

    // API Request Helper
    async apiRequest(endpoint, method = 'GET', body = null) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-18'
        };

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.errors?.[0]?.detail || 'Square API error');
            }

            return data;
        } catch (error) {
            console.error('[Square] API Error:', error);
            throw error;
        }
    },

    // ============================================
    // CUSTOMER MANAGEMENT
    // ============================================

    // Create a customer in Square
    async createCustomer(member) {
        const body = {
            idempotency_key: `torch-member-${member.id}-${Date.now()}`,
            given_name: member.name.split(' ')[0],
            family_name: member.name.split(' ').slice(1).join(' '),
            email_address: member.email,
            phone_number: member.phone,
            reference_id: `TORCH-${member.id}`,
            note: `Tier: ${member.tier} | Founding: ${member.founding ? 'Yes' : 'No'}`
        };

        const result = await this.apiRequest('/customers', 'POST', body);
        return result.customer;
    },

    // Get customer by reference ID
    async getCustomerByMemberId(memberId) {
        const result = await this.apiRequest(`/customers/search`, 'POST', {
            query: {
                filter: {
                    reference_id: {
                        exact: `TORCH-${memberId}`
                    }
                }
            }
        });
        return result.customers?.[0] || null;
    },

    // ============================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================

    // Create subscription plan (catalog item)
    async createSubscriptionPlan(productKey) {
        const product = this.products[productKey];
        if (!product) throw new Error(`Unknown product: ${productKey}`);

        const body = {
            idempotency_key: `torch-plan-${productKey}-${Date.now()}`,
            object: {
                type: 'ITEM',
                id: `#torch-${productKey}`,
                item_data: {
                    name: product.name,
                    description: product.description,
                    variations: [{
                        type: 'ITEM_VARIATION',
                        id: `#torch-${productKey}-variation`,
                        item_variation_data: {
                            name: product.name,
                            pricing_type: 'FIXED_PRICING',
                            price_money: {
                                amount: product.price,
                                currency: 'USD'
                            }
                        }
                    }]
                }
            }
        };

        const result = await this.apiRequest('/catalog/object', 'POST', body);
        return result.catalog_object;
    },

    // Subscribe a member
    async createSubscription(member, cardId) {
        const customer = await this.getCustomerByMemberId(member.id);
        if (!customer) {
            throw new Error('Customer not found in Square. Create customer first.');
        }

        const productKey = member.founding ?
            `${member.tier.toLowerCase()}Founding` :
            member.tier.toLowerCase();

        const product = this.products[productKey];

        const body = {
            idempotency_key: `torch-sub-${member.id}-${Date.now()}`,
            location_id: this.config.locationId,
            customer_id: customer.id,
            card_id: cardId,
            plan_variation_id: `torch-${productKey}-variation`, // You'll get this from catalog
            start_date: new Date().toISOString().split('T')[0],
            phases: [{
                ordinal: 0,
                order_template_id: `torch-${productKey}`,
                periods: 1
            }]
        };

        const result = await this.apiRequest('/subscriptions', 'POST', body);
        return result.subscription;
    },

    // Cancel subscription
    async cancelSubscription(subscriptionId) {
        const result = await this.apiRequest(
            `/subscriptions/${subscriptionId}/cancel`,
            'POST',
            {}
        );
        return result.subscription;
    },

    // ============================================
    // ONE-TIME PAYMENTS
    // ============================================

    // Charge for camps or overages
    async createPayment(amount, customerId, sourceId, description) {
        const body = {
            idempotency_key: `torch-payment-${Date.now()}`,
            amount_money: {
                amount: amount, // in cents
                currency: 'USD'
            },
            source_id: sourceId, // card nonce or card ID
            customer_id: customerId,
            location_id: this.config.locationId,
            note: description,
            reference_id: `TORCH-${Date.now()}`
        };

        const result = await this.apiRequest('/payments', 'POST', body);
        return result.payment;
    },

    // Charge for camp
    async chargeCamp(member, campType, cardId) {
        const customer = await this.getCustomerByMemberId(member.id);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const product = this.products[campType];
        if (!product) {
            throw new Error(`Unknown camp type: ${campType}`);
        }

        return await this.createPayment(
            product.price,
            customer.id,
            cardId,
            product.name
        );
    },

    // Charge overage hours
    async chargeOverage(member, hours, ratePerHour, cardId) {
        const customer = await this.getCustomerByMemberId(member.id);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const amount = hours * ratePerHour * 100; // Convert to cents

        return await this.createPayment(
            amount,
            customer.id,
            cardId,
            `TORCH ATL - ${hours} overage hours @ $${ratePerHour}/hr`
        );
    },

    // ============================================
    // INVOICING
    // ============================================

    // Create invoice
    async createInvoice(member, items) {
        const customer = await this.getCustomerByMemberId(member.id);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const lineItems = items.map((item, index) => ({
            uid: `line-${index}`,
            name: item.name,
            quantity: item.quantity.toString(),
            base_price_money: {
                amount: item.price,
                currency: 'USD'
            }
        }));

        const body = {
            idempotency_key: `torch-invoice-${member.id}-${Date.now()}`,
            invoice: {
                location_id: this.config.locationId,
                order_id: null, // Will be created
                primary_recipient: {
                    customer_id: customer.id
                },
                payment_requests: [{
                    request_type: 'BALANCE',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    automatic_payment_source: 'CARD_ON_FILE'
                }],
                delivery_method: 'EMAIL',
                title: 'TORCH ATL Membership Invoice',
                description: `Invoice for ${member.name}`
            }
        };

        const result = await this.apiRequest('/invoices', 'POST', body);
        return result.invoice;
    },

    // ============================================
    // CARD MANAGEMENT
    // ============================================

    // Save card on file
    async saveCard(customerId, cardNonce) {
        const body = {
            idempotency_key: `torch-card-${customerId}-${Date.now()}`,
            source_id: cardNonce,
            card: {
                customer_id: customerId
            }
        };

        const result = await this.apiRequest('/cards', 'POST', body);
        return result.card;
    },

    // Get customer's cards
    async getCustomerCards(customerId) {
        const result = await this.apiRequest(`/cards?customer_id=${customerId}`);
        return result.cards || [];
    },

    // ============================================
    // WEBHOOKS
    // ============================================

    // Webhook event handlers
    webhookHandlers: {
        'payment.completed': (event) => {
            console.log('[Square] Payment completed:', event.data.object.payment.id);
            window.dispatchEvent(new CustomEvent('torch-square', {
                detail: { type: 'paymentCompleted', data: event.data.object.payment }
            }));
        },
        'payment.failed': (event) => {
            console.log('[Square] Payment failed:', event.data.object.payment.id);
            window.dispatchEvent(new CustomEvent('torch-square', {
                detail: { type: 'paymentFailed', data: event.data.object.payment }
            }));
        },
        'subscription.created': (event) => {
            console.log('[Square] Subscription created:', event.data.object.subscription.id);
            window.dispatchEvent(new CustomEvent('torch-square', {
                detail: { type: 'subscriptionCreated', data: event.data.object.subscription }
            }));
        },
        'subscription.updated': (event) => {
            console.log('[Square] Subscription updated:', event.data.object.subscription.id);
            window.dispatchEvent(new CustomEvent('torch-square', {
                detail: { type: 'subscriptionUpdated', data: event.data.object.subscription }
            }));
        },
        'customer.created': (event) => {
            console.log('[Square] Customer created:', event.data.object.customer.id);
            window.dispatchEvent(new CustomEvent('torch-square', {
                detail: { type: 'customerCreated', data: event.data.object.customer }
            }));
        }
    },

    // Process webhook event
    processWebhook(event) {
        const handler = this.webhookHandlers[event.type];
        if (handler) {
            handler(event);
        } else {
            console.log('[Square] Unhandled webhook event:', event.type);
        }
    },

    // ============================================
    // REPORTING
    // ============================================

    // Get payments for date range
    async getPayments(startDate, endDate) {
        const params = new URLSearchParams({
            begin_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            location_id: this.config.locationId
        });

        const result = await this.apiRequest(`/payments?${params}`);
        return result.payments || [];
    },

    // Get subscriptions
    async getSubscriptions() {
        const result = await this.apiRequest('/subscriptions/search', 'POST', {
            query: {
                filter: {
                    location_ids: [this.config.locationId]
                }
            }
        });
        return result.subscriptions || [];
    },

    // Calculate MRR from Square subscriptions
    async calculateMRR() {
        const subscriptions = await this.getSubscriptions();
        const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');

        let mrr = 0;
        activeSubscriptions.forEach(sub => {
            // Get price from plan
            const price = sub.plan_variation_id ?
                this.getPriceFromPlanId(sub.plan_variation_id) : 0;
            mrr += price;
        });

        return mrr / 100; // Convert from cents to dollars
    },

    // Helper to get price from plan ID
    getPriceFromPlanId(planId) {
        for (const [key, product] of Object.entries(this.products)) {
            if (planId.includes(key)) {
                return product.price;
            }
        }
        return 0;
    }
};

// Export for use
window.TorchSquare = TorchSquare;

console.log('[Square] Module loaded. Configure credentials and call TorchSquare.init()');
