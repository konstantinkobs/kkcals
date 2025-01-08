# kkcals

A simple but (hopefully) effective calorie tracker app.


## Principles

1. Instead of needing to carefully tracking all ingredients, we use GPT-4o to estimate the calories (including some degree of uncertainty) from just a photo of the meal.
1. To take the uncertainty into account, we compute the probability of the overall calories being over the daily calorie limit.
1. Each day is a new chance to shine, so the list of food items is removed and no history is saved.
