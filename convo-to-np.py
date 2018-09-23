import numpy as np

import json
from pprint import pprint

with open('convo-object.json') as f:
  combinedDictionary = json.load(f)


np.save('conversationDictionary.npy', combinedDictionary)

conversationFile = open('conversationData.txt', 'w')
for key, value in combinedDictionary.items():
  if (not key.strip() or not value.strip()):
    # If there are empty strings
    continue
  conversationFile.write(key.strip() + ' ' + value.strip())