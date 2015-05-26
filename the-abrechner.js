Abrechnungs = new Mongo.Collection("abrechnungs");
Persons = new Mongo.Collection("persons");
Items = new Mongo.Collection("items");

Router.configure({
    layoutTemplate: 'main',
    notFoundTemplate: 'notFound'
});
Router.map(function(){
    this.route('home', {
        path: '/',
    });
    this.route('abrechner', {
        path: '/:link',
        waitOn: function() {
            var link = this.params.link;
            Session.set("link", link);
            return [
                Meteor.subscribe("abrechnungs", link),
                Meteor.subscribe("items", link),
                Meteor.subscribe("persons", link)];
        },
        data: function() {
            return Abrechnungs.findOne({"link": this.params.link});
        }
    });
});

Router.onBeforeAction('dataNotFound');

if (Meteor.isClient) {

    //Work around for template rendering animation
    Template.message.onRendered(function(){
        $(this.firstNode).fadeIn();
    });

    function showMessage(text, where){
        text += "This will definitely lead to distrust and bloodshed.";
        Blaze.renderWithData(Template.message, 
                            {"text" : text}, 
                            where, //Append to
                            $(where).children(":first-child").get(0)); //but before first child
    }

    Template.main.onRendered(function(){
        /***********************************************
        * Encrypt Email script- Please keep notice intact
        * Tool URL: http://www.dynamicdrive.com/emailriddler/
        * **********************************************/

        var emailriddlerarray=[108,117,107,46,112,117,101,104,114,105,110,103,101,114,64,103,109,97,105,108,46,99,111,109];
        var encryptedemail_id42=''; //variable to contain encrypted email 
        for (var i=0; i<emailriddlerarray.length; i++)
            encryptedemail_id42+=String.fromCharCode(emailriddlerarray[i]);
            $("#email").attr("href", "mailto:" + encryptedemail_id42);
    });

    Template.home.events({
        "submit .new-abrechner": function(event) {
            var form = event.target;
            $(form).find(".message").remove();

            var title = event.target.title.value;
            var description = event.target.description.value;
            var message = "";
            if (title.length < 1)
                message += "What, no title? ";
            if (title.length > 20)
                message += "A title with more than 20 characters is silly. ";
            if (description.length > 255)
                message += "A description with more than 255 characters is silly. ";

            if (message)
                showMessage(message, form);
            else
                Meteor.call("addAbrechner", title, description, function(err, link){
                    Router.go('abrechner', {"link": link});
                });
            return false;
        }
    });

    Template.abrechner.helpers({
        personsForAbrechnung: function(){
            return Persons.find();
        },
        itemsForAbrechnung: function(){
            return Items.find();
        },
        hasPersons: function() {
            if (Persons.find().count())
                return true;
        },
        hasItems: function() {
            if (Items.find().count())
                return true;
        },
        personNameById: function(personId) {
            var person = Persons.findOne(personId);
            if (person)
                return person.name;
            else
                return "";
        }
    });

    Template.abrechner.events({
        // Add new Person
        "submit .new-person": function (event) {
            var form = event.target;
            $(form).find(".message").remove();

            var link = Session.get("link");
            var name = event.target.person.value;

            var message = "";
            if (name.length < 1)
                message += "What, your person has no name? ";
            if (name.length > 20)
                message += "Persons with names with more than 20 characters are silly. ";
            if (Persons.find({"name": name}).count() > 0)
                message += "There is already someone with that name. ";

            if (message){
                showMessage(message, form);
            } else {
                Meteor.call("addPerson", link, name);
                event.target.person.value = "";
            }

            
            return false;
        },
        "click .delete-person": function () {
            var form = $("form.new-person").get(0);
            $(form).find(".message").remove();

            var link = Session.get("link");
            var personId = this._id;
            var message = "";
            if (Items.find({"paidBy" : personId}).count() > 0)
                message = "Hey, this person has already paid for something. ";

            if (message)
                showMessage(message, form)
            else
                Meteor.call("removePerson", link, personId);
            return false;
        },
        // Add new item
        "submit .new-item": function (event) {
            var form = event.target;
            $(form).find(".message").remove();

            var link = Session.get("link");
            var title = event.target.item.value;
            var amount = event.target.amount.value.replace(",",".");
            var personId = event.target.person.value;

            var message = "";
            if (title.length < 1)
                message += "What, no title? ";
            if (title.length > 20)
                message += "Item titles with more than 20 characters are silly. ";
            if (!$.isNumeric(amount))
                message += "You specified a silly number for the costs! ";
            if (Persons.find(personId).count() < 1)
                message += "Who paid for the item? ";

            if (message){
                showMessage(message, form);
            } else {
                amount = parseFloat(amount)
                Meteor.call("addItem", link, title, amount, personId);
                event.target.item.value = "";
                event.target.amount.value = "";
            }
            return false;
        },
        "click .delete-item": function () {
            var link = Session.get("link");
            var itemId = this._id;
            Meteor.call("removeItem", link, itemId);
        },

        "change .pays-share": function(event) {
            var link = Session.get("link");
            var itemId = $(event.target).data("item-id");
            var personId = this.person;
            var checked = event.target.checked;

            Meteor.call("updateShare",link, itemId, personId, checked);
        },
        "click .delete-abrechnung": function(event) {
            var link = Session.get("link");
            var abrechnungsId = this._id;
            Meteor.call("removeAbrechnung", link, abrechnungsId);
            Router.go('home');
        },

        "click .mark-url": function(event) {
            $("#url").focus();
            $("#url").select();
        }
    });





    Template.breakdown.onRendered(function(){
        //Datatables
       var table = $('#breakdownTable').dataTable({
            "ordering": true,
            "paging": false,
            "info" : false,
            "bFilter": false,
        }).api();

       Tracker.autorun(function(){
            var persons = new Array(); 
            Persons.find().forEach(function(person) {
               return persons[person._id] = { "name": person.name, "paid": 0, "pays": 0};
            });

            //Go through all items and fill persons Array
            Items.find().forEach(function(item){
                //Add paid amount to paying person
                persons[item.paidBy].paid += item.amount;

                //Check how many persons want to pay and divide 
                var divider = 0;
                item.shares.forEach(function(share){
                    if (share.pays)
                        divider += 1;
                });
                var absShare = 0;
                if (divider > 0)
                    absShare = item.amount / divider;

                //Add pays amount to all persons
                item.shares.forEach(function(share){
                    if (share.pays)
                        persons[share.person].pays += absShare;
                });
            });
            table.clear();
            Object.keys(persons).forEach( function(key) { 
                table.row.add([persons[key].name, 
                               persons[key].paid.toFixed(2), 
                               persons[key].pays.toFixed(2),
                               (persons[key].paid - persons[key].pays).toFixed(2)]);
             });
            table.draw();
       });

        // Draw pie if container rendered for the first time
        var paperH = 300, paperW = 300
        var paper = Raphael("raphael-container", paperW, paperH);
        Tracker.autorun(function(){
            var items = Items.find().fetch();
            paper.clear();
            var totalAmounts = [];
            var totalItems = [];
            items.forEach(function(item){
                totalAmounts.push(item.amount);
                totalItems.push(item.title + " - € " + item.amount);
            });
            var chart = paper.piechart(150, 150, 100, totalAmounts, {
                legend: totalItems, 
                legendpos: "south", 
            });  
            var legendH = $("#raphael-container svg text").height() * items.length;
            paper.setSize(paperW, paperH + legendH)
        });
    });

    Template.breakdown.helpers({
        toFixed: function(number) {
            return number.toFixed(2);
        },
        diffClass: function(diff) {
            if (diff < 0)
                return "text-danger";
            else
                return "text-success";
        }, 
        sum: function(){
            var sum = 0;
            Items.find().forEach(function(item){
                sum += item.amount;
            });
            return sum.toFixed(2);
        },
        fairShare: function() {
            var sum = 0;
            Items.find().forEach(function(item){
                sum += item.amount;
            });
            return sum / Persons.find().count()
        }
    })
}

if (Meteor.isServer) {

    Meteor.publish("abrechnungs", function (link) {
        return Abrechnungs.find({"link": link});
    });
    Meteor.publish("items", function (link) {
        return Items.find({"link": link});
    });
    Meteor.publish("persons", function (link) {
        return Persons.find({"link": link});
    });
}

Meteor.methods({
    /*
     * Create a hash5 link based on current Time and a random int
     * For collision should be tested
     */
    _createLink: function() {
        //Link must be unique!!
        do {
            var rand = new Date().getTime().toString() + Math.floor(Math.random() * 10000 + 1).toString();
            var hash = CryptoJS.MD5(rand);
            var link = hash.toString();
        } while(Abrechnungs.find({"link" : link}).count() > 0)

        return link;
    },
    addAbrechner: function(title, description) {

        var link =  Meteor.call("_createLink");
        Abrechnungs.insert({"title": title, "description": description, "link": link, createdAt: new Date()});
        return link;
    },
    addPerson: function(link, name){
        var personId = Persons.insert({"link": link, "name": name})
        Items.update(
            {"link": link},
            {$push: {
                "shares" : { 
                    "person": personId, "pays" : true 
                }}}, {multi: true})
    },
    removePerson: function(link, personId) {
        Items.update({"link": link}, {$pull: {"shares" : {"person" : personId}}}, {multi: true});
        Persons.remove(personId);
    },
    addItem: function(link, title, amount, personId) {
        //Create share array for all existing persons

        var shares = Persons.find({"link": link}).map(function(p){
                                        return {
                                                person: p._id, 
                                                pays: true
                                            }
                                    });
        Items.insert({"link": link,                         
                      "title"  : title, 
                      "amount" : amount, 
                      "paidBy" : personId, 
                      "shares" : shares })
    },
    removeItem: function(link, itemId) {
        Items.remove({"_id": itemId, "link": link});
    },
    updateShare: function (link, itemId, personId, pays) {
        Items.update({
            "_id" : itemId, 
            "link": link,
            "shares.person": personId
        }, {$set: {"shares.$.pays": pays}});
    },
    removeAbrechnung: function(link, abrechnungsId) {
        Items.remove({"link": link});
        Persons.remove({"link": link});
        Abrechnungs.remove({"_id": abrechnungsId, "link": link});
    }
});
