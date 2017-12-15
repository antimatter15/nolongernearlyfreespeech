import urllib2
import time
import json

log = open("questions.json", "r+")

offset = sum(1 for line in log)
count = 16900
print "Continuing from offset ", offset

while offset < count:
	while True:
		try:
			ts = int(time.time() * 1000)
			print "Requesting next batch from server"
			params = "params%5Banswer%5D=&params%5Boffset%5D="+str(offset)+"&_="+str(ts)+"&params%5Bsort%5D=date" 
			url = 'http://ec2-107-20-11-96.compute-1.amazonaws.com/api/tossup.search?' + params
			print url
			response = urllib2.urlopen(url)
			j = json.loads(response.read())
		except:
			print "Returned error, trying again"
			time.sleep(60)
			continue
		else:
			break
	if len(j['results']) == 10 or offset + 10 > count:
		if j['count'] > count:
			count = j['count']
		offset += 10
		for question in j['results']:
			log.write(json.dumps(question) + "\n")	
			print question['question'].encode("ascii", "ignore")
		print "---------------------------"
		print offset, count, str(100 * offset/count) + "%"
		log.flush()
		time.sleep(5)
	else:
		print "The server returned less than expected", len(j['results'])
		time.sleep(60)
log.close()
