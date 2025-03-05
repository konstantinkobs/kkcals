document.addEventListener('alpine:init', () => {
    Alpine.data('kkcals', () => ({
        apiKey: Alpine.$persist(''),
        calorieThreshold: Alpine.$persist(2000),
        items: Alpine.$persist([]),
        // sum of two normal distributions with means m1 and m2 and std1 and std2 have a new mean m1+m2 and std of sqrt(std1^2 + std^2) (i.e. the variance is summed)
        get totalMean() {
            return this.items.reduce(
                (sum, item) => sum + item.mean,
                0
            );
        },
        get totalStd() {
            return Math.sqrt(
                this.items.reduce(
                    (sum, item) => sum + Math.pow(item.std, 2),
                    0
                )
            );
        },
        get probabilityAboveThreshold() {
            return this.computeProbabilityOverThreshold(
                this.totalMean,
                this.totalStd,
                this.calorieThreshold
            );
        },
        additionalDescription: '',
        fileSelected: false,
        loading: false,

        selectedIndex: null,

        get probabilityAboveThresholdCSSClass() {
            if (this.probabilityAboveThreshold <= 25) {
                return 'summary-good';
            } else if (this.probabilityAboveThreshold <= 75) {
                return 'summary-caution';
            } else {
                return 'summary-bad';
            }
        },

        init() {
            this.cleanOldItems();
        },

        cleanOldItems() {
            // Remove items that were not from today
            const today = this.getTodayString();
            this.items = this.items.filter(
                (item) => item.date === today
            );
        },

        getTodayString() {
            return new Date().toJSON().slice(0, 10);
        },

        addItem() {
            const file = this.$refs.image_upload.files[0];
            if (!file || !this.apiKey) return;

            this.loading = true;

            const jsonSchema = {
                name: 'calorie_estimate',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        mean_kcals: {type: 'integer'},
                        std_kcals: {type: 'integer'},
                        short_food_description: {type: 'string'},
                    },
                    required: [
                        'mean_kcals',
                        'std_kcals',
                        'short_food_description',
                    ],
                    additionalProperties: false,
                },
            };

            const reader = new FileReader();
            reader.onload = async () => {
                const base64Image = reader.result;
                try {
                    const response = await fetch(
                        'https://api.openai.com/v1/chat/completions',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${this.apiKey}`,
                            },
                            body: JSON.stringify({
                                model: 'gpt-4o-2024-11-20',
                                messages: [
                                    {
                                        role: 'system',
                                        content:
                                            'You are a calorie estimation assistant. Given an image of food or drink along with a textual description, estimate the calorie content. Respond with a JSON object.',
                                    },
                                    {
                                        role: 'user',
                                        content: [
                                            {
                                                type: 'text',
                                                text: `Estimate the calories for the following image. Use the following optional additional information for your estimate: ${this.additionalDescription}`,
                                            },
                                            {
                                                type: 'image_url',
                                                image_url: {
                                                    url: base64Image,
                                                },
                                            },
                                        ],
                                    },
                                ],
                                response_format: {
                                    type: 'json_schema',
                                    json_schema: jsonSchema,
                                },
                            }),
                        }
                    );

                    if (response.ok && response.status == 200) {
                        const result = await response.json();
                        const assistantMessage = JSON.parse(
                            result.choices[0].message.content
                        );

                        this.items.push({
                            date: this.getTodayString(),
                            description:
                                assistantMessage.short_food_description,
                            mean: assistantMessage.mean_kcals,
                            std: assistantMessage.std_kcals,
                        });
                    } else {
                        throw new Error(JSON.stringify({ code: response.status, message: response.statusText }))
                    }
                } catch (error) {
                    alert(`Error: ${error}`)
                }

                // Reset UI: Remove file input and reset fileSelected, clear additional text clarification
                this.$refs.image_upload.value = '';
                this.fileSelected = false;
                this.additionalDescription = '';

                this.loading = false;
            };
            reader.readAsDataURL(file);
        },

        removeItem(index) {
            this.items.splice(index, 1);
            this.selectedIndex = null;
        },

        favoriteItems: Alpine.$persist([]),
        favoriteItem(index) {
            this.favoriteItems.push({...this.items[index]});
            alert("Item added to Favorites");
            this.selectedIndex = null;
        },
        addFavoriteItem(index) {
            const item = {...this.favoriteItems[index]};
            item["date"] = this.getTodayString();
            this.items.push(item);
            alert("Item added");
        },
        removeFavoriteItem(index) {
            if (confirm("Are you sure you want to delete your favorite?")) {
                this.favoriteItems.splice(index, 1);
            }
        },
        scrollToFavorites() {
            this.$refs.favorites.scrollIntoView({
                behavior: "smooth"
            })
        },

        computeProbabilityOverThreshold(mean, std, threshold) {
            // https://en.wikipedia.org/wiki/Normal_distribution
            return (
                100 *
                (1 -
                    0.5 *
                        (1 +
                            this.erf(
                                (threshold - mean) /
                                    (std * Math.sqrt(2))
                            )))
            );
        },

        erf(x) {
            const sign = x >= 0 ? 1 : -1;
            const a1 = 0.254829592;
            const a2 = -0.284496736;
            const a3 = 1.421413741;
            const a4 = -1.453152027;
            const a5 = 1.061405429;
            const p = 0.3275911;

            const absX = Math.abs(x);
            const t = 1 / (1 + p * absX);
            const y =
                1 -
                ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
                    t *
                    Math.exp(-absX * absX);

            return sign * y;
        },
    }));
});
