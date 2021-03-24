# The function of recipescraper is to output meal data in JSON form
# 1. Read CSV meal data exported from a google sheet
# 2. Scrape data from URLs provided in the CSV file
# 3. Parse ingredient data as JSON
# 4. Output JSON into output.json

# Import scraping, html request, regex, and math modules
from bs4 import BeautifulSoup
import urllib.request
import re, math

# Define arrays to store meal data pulled from the CSV
# These are parrallel lists, meaning the same index for each list corresponds to the same recipe
urls = []
types = []
category = []
names = []

# Open our CSV and split it into seperate lines, each line is a different recipe
lines = open("mealscsv.csv", "r").read().split("\n")

# Iterate through each line of the CSV
for line in lines:

    # Usually we can just split data from CSVs by commas, but, when we save our data on categories and types we format it like this:
    # "Chicken, Vegetable", So we need to split by comma unless the comma is with quotes
    values = list(filter(lambda x: not x == None, re.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", line)))
    print(line)
    # Get the second (types) and third (categories) columns of the CSV
    second = values[2]
    third = values[3]
    
    if second[0] == "\"":   # If the first character of the types column is a quote (like this: "Breakfast, Lunch"), parse the types as a list
        typ = list(map(lambda x: x.strip(), second[1:-1].split(",")))   # Get rid of extra whitespace and split by comma excluding edge quotes
    else:                   # If the first character of the types column isn't a quote, treat it just as a single type
        typ = [second.strip()]

    if third[0] == "\"":    # If the first character of the categories column is a quote (like this: "Chicken, Vegetable"), parse the categories as a list
        cat = list(map(lambda x: x.strip(), third[1:-1].split(",")))    # Get rid of extra whitespace and split by comma excluding edge quotes
    else:                   # If the first character of the types column isn't a quote, treat it just as a single category
        cat = [third.strip()]

    # Pull out URL and meal name from CSV
    url = values[4].split("?")[0]
    name = values[1].replace("\"","")
    
    # Add each piece of data to the parrallel lists
    types.append(typ)
    category.append(cat)
    names.append(name)
    urls.append(url)

# This function takes in unicode fractions and converts them to their fractional form, this way they can be added and mainputed later
def parseNum(word):
    try:                # If the value is a whole number/non-unicode fraction turn it directly into an int
        return int(word)
    except ValueError:  # Convert unicode fractions to ints
        if "½" in word:   return 1/2   
        elif "⅓" in word:   return 1/3  
        elif "⅔" in word:   return 2/3
        elif "¼" in word:   return 1/4  
        elif "¾" in word:   return 3/4  
        elif "⅕" in word:   return 1/5  
        elif "⅖" in word:   return 2/5  
        elif "⅗" in word:   return 3/5  
        elif "⅘" in word:   return 4/5  
        elif "⅙" in word:   return 1/6  
        elif "⅚" in word:   return 5/6
        elif "⅛" in word:   return 1/8
        elif "⅜" in word:   return 3/8
        elif "⅝" in word:   return 5/8
        elif "⅞" in word:   return 7/8
    return -1   # If there is no number, return -1

# Identify and return the index of specifers in the ingredient, specifiers are stuff like: "(7 ounce)", "(6 inch)"
def parseSpecifier(words, i):
    specifier = ""
    word = words[i]    # Get second word from ingredient

    try:
        if "(" in word and ")" in word: # Checks if word looks like this: "(specifier)"
            specifier = word
            return (specifier, i+1)
        elif "(" in word:               # Check if word looks like this: "(string"
            specifier += word
            for w in words[2:]:         # Iterates through words after the "(string"
                i += 1
                specifier += " " + w
                if ")" in w:            #  Checks if word looks like this: "string)"
                    return (specifier, i+1)
            return ("", i)
        else:
            return ("", i)
    except IndexError:                  # If the ingredient doesn't have enough words, just return empty
        return ("", i)

# Define a list of units to be parsed
units = ["teaspoon","tablespoon","cup","pint","ounce","package","slice","pinch","clove","piece","pound","can","container","jar"]

# De-pluralize the unit in the ingredient and see if it matches one of our listed units
def parseUnit(word):
    if word[-1] == "s":     # If the last character is an s, cut the string so it excludes the last character
        word = word[:-1]   
    if word in units:       # If the unit given is in our listen of units, it is valid an return it
        return word
    else:                   # Otherwise, return nothing
        return ""

# Uses regex to find a substring inside another string but only if that substring is its own word
# Examples: "by", "by the sea" -> true, "by", "bartleby" -> false
def string_found(string1, string2):
   if re.search(r"\b" + re.escape(string1) + r"\b", string2):
      return True
   return False

# Pull a list of ingredients from ingredients.txt to standardize the ingredients of each recipe for easy adding
# This list was taken from: https://github.com/schollz/food-identicon/blob/master/ingredients.txt
categories = open("ingredients.txt").read().split("\n")

# Checks if the ingredient can be categorized from a standarized list of ingredients
def categorize(ingredient, knownUnit):
    result = ""
    ingredient = ingredient.lower()     # Turn ingredient string to lower case

    # Iterate through each of our standardized ingredients
    for category in categories: 

        # If the ingredient name is within the category, disregarding plurality of the ingredient name, proceed
        if string_found(category, ingredient) or (category[:-1] in ingredient and category[-1] == "s"):
            # Only proceed if the ingredient unit is in the category, the unit not is empty, or neither, not both
            if not(knownUnit in category and not knownUnit == ""):
                result = category    
    return result 

# Main function to parse recipe data from info pulled from the CSV
def parseRecipes(urls):

    # Get HTML data from each url
    htmls = []
    for url in urls:                        # Iterate through each url
        fp = urllib.request.urlopen(url)    # Request the URL webpage
        byts = fp.read()                    # Read the webpage as bytes

        html = byts.decode("utf8")          # Parse the bytes as plaintext
        fp.close()

        htmls.append(html)                  # Add the html to a list
    print("[1/5]: HTML data collected")

    # Scrape data from each HTML data

    # Create empty data structures to store scraped data
    ingredients = {}
    nutritions = {}
    images = []
    servings = []

    # Iterate through each HTML data
    i = 0
    for html in htmls:
        soup = BeautifulSoup(html, 'html.parser')   # Create HTML parser

        meal_name = names[i]    # Get meal name
        print(meal_name)
        # Scrape each ingredient element
        elements = soup.findAll("span", {"class": "ingredients-item-name"}) 
        ingredients[meal_name] = list(map(lambda element: element.getText().strip(), elements))

        # Get each piece of nutrition info
        nutritions[meal_name] = soup.find("div", {"class": "partial recipe-nutrition-section"}).find("div", {"class": "section-body"}).getText().strip()
        
        # Get meal image
        images.append(soup.find("div", {"class": "image-container"}).find("img")["src"])    # Scrape meal image from site
        
        # Scrape the number of servings
        servings.append(int(soup.findAll("div", {"class": "two-subcol-content-wrapper"})[1].find("div", {"class": "recipe-meta-item"}).find("div", {"class": "recipe-meta-item-body"}).getText().strip()))
        i += 1
    print("[2/5]: HTML data scraped")

    foods = {}  # Dictionary of each meal

    # Parse nutrition info

    # Iterate through each nutrition text for each meal
    for meal in nutritions.keys():

        # Create empty data structures for storing nutrition info
        foods[meal] = {}
        foods[meal]["nutrition"] = {}

        nutrition = nutritions[meal].strip()    # Strip whitespace from nutrition text
        for component in nutrition.split(";"):  # Split nutrition text by semicolon, this splits the nutrition into calories, carbs, protein, etc.
            component = component.split(".")[0].strip() # Remove period from nutrition component and remove whitespace
            parts = component.split(" ")    # Split each nutrition component into its parts

            # Remove units from the nutrition text parts and store into our data
            if parts[1] == "calories":  
                foods[meal]["nutrition"][parts[1]] = int(parts[0].replace("g","").replace("mg","").replace("m",""))
            else:
                foods[meal]["nutrition"][parts[0]] = int(parts[1].replace("g","").replace("mg","").replace("m",""))
    print("[3/5]: Nutirition Info Scraped")

    # Parse each ingredient

    # Iterate through each meal name 
    for meal in ingredients.keys():
        foods[meal]["ingredients"] = []
        print(meal)

        # Iterate through each ingredient in the meal
        for ingredient in ingredients[meal]:

            ingredient = " ".join(ingredient.split())   # Removes double spaces
            words = ingredient.split(" ")               # Splits ingredient text into seperate words
            data = { "num": 0, "specifier": "", "unit": "", "item": ""} # Create empty ingredient data structure

            # Parse amount in ingredient
            data["num"] = parseNum(words[0])
            if parseNum(words[1]) != -1:    # If there is no amount
                data["num"] += parseNum(words[1])
                data["specifier"], i = parseSpecifier(words,2)
            else:                           # If there is an amount
                data["specifier"], i = parseSpecifier(words,1)

            # Parse unit and ingredient name
            data["unit"] = parseUnit(words[i])
            data["item"] = categorize(ingredient, data["unit"])

            # Add ingredient info to list
            foods[meal]["ingredients"].append(data)
    print("[4/5]: Ingredients parsed")
        
    # Add metadata to the json
    i = 0
    for food in foods.keys():
        foods[food]["url"] = urls[i]
        foods[food]["image"] = images[i]
        foods[food]["category"] = category[i]
        foods[food]["type"] = types[i]
        foods[food]["enabled"] = True
        foods[food]["servings"] = servings[i]
        i += 1
    print("[5/5]: Metadata added")
    
    # Return finalized recipe data
    return foods

# Import json saving module
import json

# Call recipe parsing with the urls we pull from the CSV
recipes = parseRecipes(urls)

# Open output.json and save our recipes to it
with open('output.json', 'w') as fp:
    json.dump(recipes, fp)
 

