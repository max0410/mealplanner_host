const fs = require('fs');

var meal = {"category":["Pizza","Chicken"],"enabled":true,"image":"https://imagesvc.meredithcorp.io/v3/mm/image?url=https%3A%2F%2Fimages.media-allrecipes.com%2Fuserphotos%2F875771.jpg","ingredients":[{"num":"2","unit":"tablespoon","specifier":"","item":"olive oil"},{"item":"olive oil","num":0.3333333333333333,"specifier":"","unit":"tablespoon"},{"item":"chicken breast half","num":0.16666666666666666,"specifier":"","unit":""},{"item":"italian seasoning","num":0.5,"specifier":"","unit":"teaspoon"},{"item":"onion","num":0.16666666666666666,"specifier":"","unit":""},{"item":"garlic","num":0.3333333333333333,"specifier":"","unit":"clove"},{"item":"mushrooms","num":0.16666666666666666,"specifier":"(8 ounce)","unit":"package"},{"item":"water","num":2,"specifier":"","unit":"teaspoon"},{"item":"spinach","num":0.16666666666666666,"specifier":"(10 ounce)","unit":""},{"item":"pizza crust","num":0.16666666666666666,"specifier":"(12 inch)","unit":""},{"item":"jar pizza sauce","num":0.16666666666666666,"specifier":"(14 ounce)","unit":""},{"item":"tomato","num":0.16666666666666666,"specifier":"","unit":""},{"item":"gorgonzola cheese","num":4,"specifier":"","unit":"teaspoon"},{"item":"cheese","num":0.6666666666666666,"specifier":"","unit":"ounce"}],"nutrition":{"calories":441,"carbohydrates":46,"cholesterol":50,"fat":17,"protein":26,"sodium":1094},"type":["Lunch","Dinner"],"url":"https://www.allrecipes.com/recipe/159385/chicken-and-gorgonzola-pizza/"}

function addIngredients(meal) {
    var sorted_by_item = {}
    meal["ingredients"].forEach(ingredient => {
        if (sorted_by_item[ingredient["item"]]) {
            sorted_by_item[ingredient["item"]].push(ingredient)
        } else {
            sorted_by_item[ingredient["item"]] = [ingredient]
        }
    })                              
                
    var final_list = {}

    Object.keys(sorted_by_item).forEach(item => {   // Go through each type of item in the sorted_items
        var sorted_foods = sorted_by_item[item]     // Get the array for each type of item
        var additions = {}
        sorted_foods.forEach(food => {              // Iterate through each food in this array
            if (food["unit"] == "tablespoon"){       // Convert to common unit
                food["num"] *= 3
                food["unit"] = "teaspoon"
            } else if (food["unit"] == "cup") {
                food["num"] *= 48
                food["unit"] = "teaspoon"
            } else if (food["unit"] == "ounce") {
                food["num"] *= 6
                food["unit"] = "teaspoon"
            } 
            var specifier = ""
            if (food["specifier"] != "") {
                specifier = " " + food["specifier"]
            }
            if (additions[food["unit"] + specifier]) {
                additions[food["unit"] + specifier] += food["num"]
            } else {
                additions[food["unit"] + specifier] = food["num"]
            }
            console.log(additions)
        })
        final_list[item] = additions
    })

    var product = []
    Object.keys(final_list).forEach(item => {
        Object.keys(final_list[item]).forEach(unit => {
            var specifier = ""
            if (unit.match(/\(([^)]+)\)/)) { 
                var specifier = "("+ unit.match(/\(([^)]+)\)/)[1] +")"
            }
            var funit = unit.replace(/ *\([^)]*\) */g, "");
            product.push({"item":item, "unit":funit, "num":final_list[item][unit], "specifier":specifier})
        })
        
    })
    return product
}

console.log(addIngredients(meal))