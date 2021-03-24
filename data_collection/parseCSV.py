import re

urls = []
types = []
category = []

lines = open("Meals - Meals.csv", "r").read().split("\n")
for line in lines:
    values = list(filter(lambda x: not x == None, re.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", line)))
    second = values[2]
    third = values[3]
    
    if second[0] == "\"":
        typ = list(map(lambda x: x.strip(), second[1:-1].split(",")))
        print(typ)
    else:
        typ = [second.strip()]

    if third[0] == "\"":
        cat = list(map(lambda x: x.strip(), third[1:-1].split(",")))
        print(cat)
    else:
        cat = [third.strip()]

    url = values[4].split("?")[0]

    print(values)
    print(str(typ) + "\t" + str(cat) + "\t" + url + "\n")
    
    types.append(typ)
    category.append(cat)
    print("!!!!!!" +url)
    urls.append(url)

print(types)
print(category)
print(urls)
