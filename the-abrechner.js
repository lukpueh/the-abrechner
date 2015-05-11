Persons = new Mongo.Collection("persons");
Items = new Mongo.Collection("items");

if (Meteor.isClient) {
    Template.body.helpers({
        persons: function () {
            return Persons.find({});
        },
        items: function() {
            return Items.find({});
        }
    });

    Template.body.events({
        "submit .new-person": function (event) {
            var name = event.target.person.value;
            Persons.insert({name: name});
            event.target.person.value = "";
            return false;
        },
        "submit .new-item": function (event) {
            var title = event.target.item.value;
            var amount = event.target.amount.value;
            var personId = event.target.person.value;
            var person = Persons.findOne(personId);
            var shares = Persons.find().map(function(u){return {person: u, percent: 100} });
            Items.insert({title: title, amount: amount, paidBy: person, shares: shares });
            event.target.item.value = "";
            event.target.amount.value = "";
            return false;
        },

        "submit .item-shares": function(event) {
            return false;
        }
    });

    Template.person.events({
        "click .delete": function () {
            Persons.remove(this._id);
        }
    });
    Template.item.events({
        "click .delete": function () {
            Items.remove(this._id);
        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
