### TO BE CHANGED
### Supports .jpg .png .gif

from gmail.gmail.gmail import Gmail
import time, os, sys, json

password = json.loads(open("../resources/keys.json", "r").read())["1540password"]

def containsNumber(string):
    return any(char.isdigit() for char in string)

def login(g):
    try:
        g.login("1540photo",password)
    except:
        time.sleep(10)
        login(g)
def run():
    g = Gmail()
    login(g)
    emails = g.inbox().mail(unread=True)
    for email in emails:
        email.fetch()
        subject = email.subject
        for attachment in email.attachments:
            if attachment.name[-5:]==".tiff" or attachment.name[-4:]==".jp2":
                print "An image was received without a proper format."
            else:
                try:
                    subject = int(email.subject)
                except:
                    if not containsNumber(subject):
                        print "An email was received without a proper subject."
                        break
                    else:
                        foundNum = False
                        newSubject = ""
                        for c in subject:
                            c = str(c)
                            if c.isdigit():
                                newSubject=newSubject+c
                                foundNum = True
                            elif foundNum == True:
                                break
                        subject=newSubject
                subject = str(subject)
                exists = True
                num = 0
                while exists:
                    if os.path.isfile("./data/images/" + str(subject) + "-" + str(num) + ".jpg"):
                        num+=1
                    else:
                        exists = False
                print 'Saving attachment: ' + str(num) + "-" + str(subject)
                print 'Size: ' +str(attachment.size) + 'KB'
                attachment.save("./data/images/" + str(subject) + "-" + str(num) + ".jpg");
                json_file = open("./data/images/manifest.json", "r").read()
                json_file = json_file[:-1] + ",\"" + str(subject) + "-" + str(num) + ".jpg\"]"
                open("./data/images/manifest.json", "w").write(json_file)
        email.read()
    g.logout()
    sys.exit()
run()
