from bluetooth import *
import json, os
from urllib.parse import urlparse

server_sock = BluetoothSocket(RFCOMM)
server_sock.bind(("", PORT_ANY))
server_sock.listen(1)

port = server_sock.getsockname()[1]

uuid = json.loads(open("../resources/keys.json", "r").read())["bluetoothUUID"]

advertise_service(server_sock, "SampleServer",
                  service_id=uuid,
                  service_classes=[uuid, SERIAL_PORT_CLASS],
                  profiles=[SERIAL_PORT_PROFILE],
                  #                   protocols = [ OBEX_UUID ]
                  )

print("Waiting for connection on RFCOMM channel %d" % port)

while True:
    client_sock, client_info = server_sock.accept()
    print(client_sock)
    strMessage = ""
    try:
        while True:
            print("still true")
            data = client_sock.recv(1024).decode("utf-8")
            if data == "end":
                break
            strMessage += data
    except IOError:
        pass

    client_sock.close()

    jsonMessage = json.loads(strMessage)

    print(jsonMessage)

    device = jsonMessage["info"]["device"]
    filename = jsonMessage["info"]["filename"]
    data_type = jsonMessage["info"]["type"]
    data_manifest = []

    if not os.path.exists("../data/devices/" + device):
        os.mkdir("../data/devices/" + device)
        os.mkdir("../data/devices/" + device + "/stand")
        os.mkdir("../data/devices/" + device + "/pit")
        os.mkdir("../data/devices/" + device + "/notes")

        #manifest handling
        stand_manifest = open("../data/devices/" + device + "/stand/manifest.json", "w")
        pit_manifest = open("../data/devices/" + device  + "/pit/manifest.json", "w")
        notes_manifest = open("../data/devices/" + device  + "/notes/manifest.json", "w")
        stand_manifest.write("[]")
        pit_manifest.write("[]")
        notes_manifest.write("[]")
        stand_manifest.close()
        pit_manifest.close()
        notes_manifest.close()

        device_manifest_file = open("../data/devices/manifest.json","r+")
        device_manifest = json.loads(device_manifest_file.read())
        device_manifest.append(device)
        print(device_manifest)
        device_manifest_file.seek(0)
        device_manifest_file.write(json.dumps(device_manifest))
        device_manifest_file.truncate()
        device_manifest_file.close()
    else:
        data_manifest_file = open("../data/devices/" + device + "/" + data_type + "/manifest.json","r")
        data_manifest = json.loads(data_manifest_file.read())
        data_manifest_file.close()

    if not filename in data_manifest:
        data_manifest.append(filename)
        data_manifest_file = open("../data/devices/" + device + "/" + data_type + "/manifest.json","w")
        data_manifest = data_manifest_file.write(json.dumps(data_manifest))
        data_manifest_file.close()

    data_file = open("../data/devices/" + device + "/" + data_type + "/" + filename, "w")
    data_file.write(strMessage)
    data_file.close()

    print("File saved!")
