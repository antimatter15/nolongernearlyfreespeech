import os
template = open("pages/template.html").read()
sidebar = open("pages/sidebar.html").read()
for fn in os.listdir("pages"):
  if fn == "sidebar.html" or fn == "template.html":
    continue
  out = open(fn,"w")
  f = open("pages/"+fn)
  title = f.readline()
  
  content = f.read()
  out.write(template.replace("[[title]]", title).replace("[[content]]", content).replace("[[sidebar]]", sidebar))
  print fn
